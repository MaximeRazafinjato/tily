using System.Runtime.InteropServices;
using System.Text.Json;
using Microsoft.UI.Xaml.Controls;
using Microsoft.Web.WebView2.Core;
using Tily.Core.Browser;
using Tily.Core.Session;
using Windows.Foundation;

namespace Tily.Host.Bridge;

public sealed class BrowserFeed : IDisposable
{
    public const string Prefix = """{"type":"browser.""";
    private static readonly TimeSpan NavigationTimeout = TimeSpan.FromSeconds(30);

    private readonly Canvas _layer;
    private readonly Func<CoreWebView2Environment?> _environment;
    private readonly Action<object> _post;
    private readonly Action _focusInterface;
    private readonly Dictionary<string, BrowserView> _views = new();
    private readonly BrowserCallbacks _callbacks;

    public BrowserFeed(Canvas layer, Func<CoreWebView2Environment?> environment, Action<object> post, Action focusInterface)
    {
        _layer = layer;
        _environment = environment;
        _post = post;
        _focusInterface = focusInterface;
        _callbacks = new BrowserCallbacks(PostState, PostNewPane, PostKey, PostFocused);
    }

    public void Receive(string json)
    {
        BrowserCommandModel? command;
        try
        {
            command = JsonSerializer.Deserialize<BrowserCommandModel>(json, SessionRepository.JsonOptions);
        }
        catch (JsonException)
        {
            _post(new { type = "error", message = "Message du navigateur illisible." });
            return;
        }

        if (command is not null)
        {
            _ = HandleAsync(command);
        }
    }

    private async Task HandleAsync(BrowserCommandModel command)
    {
        try
        {
            var result = await DispatchAsync(command);
            if (command.Request > 0)
            {
                _post(new { type = "browser.reply", request = command.Request, result = result ?? new { } });
            }
        }
        catch (Exception exception) when (exception is InvalidOperationException or COMException or ArgumentException or TimeoutException)
        {
            var message = exception is COMException ? $"Le navigateur a échoué : {exception.Message}" : exception.Message;
            _post(command.Request > 0 ? new { type = "browser.reply", request = command.Request, error = message } : new { type = "error", message });
        }
    }

    private async Task<object?> DispatchAsync(BrowserCommandModel command)
    {
        switch (command.Type)
        {
            case "browser.attach":
                await AttachAsync(command);
                return null;
            case "browser.bounds":
                Find(command)?.SetBounds(new Rect(command.X, command.Y, Math.Max(0, command.Width), Math.Max(0, command.Height)), command.Visible);
                return null;
            case "browser.snapshot":
                return new { image = await Require(command).SnapshotAsync() };
            case "browser.navigate":
                var url = BrowserAddress.Normalize(command.Url);
                return command.Request > 0 ? await Require(command).NavigateAsync(url, NavigationTimeout) : Navigate(Require(command), url);
            case "browser.back":
                Require(command).Back();
                return null;
            case "browser.reload":
                return command.Request > 0 ? await Require(command).ReloadAsync(NavigationTimeout) : Reload(Require(command));
            case "browser.viewport":
                var view = Require(command);
                await view.SetViewportAsync(BrowserViewports.Parse(command.Viewport));
                return view.State();
            case "browser.devtools":
                Require(command).OpenDevTools();
                return null;
            case "browser.focus":
                Find(command)?.Focus();
                return null;
            case "browser.close":
                Close(command.Pane);
                return null;
            case "browser.console":
                return Require(command).Log.Console(Level(command.Level), command.SinceLoad, Math.Max(1, command.Limit));
            case "browser.network":
                return Require(command).Log.Network(command.FailedOnly, command.SinceLoad, Math.Max(1, command.Limit));
            case "browser.screenshot":
                return await Require(command).CaptureAsync(BrowserViewports.Parse(command.Viewport), command.FullPage);
            default:
                throw new InvalidOperationException($"Commande inconnue : {command.Type}");
        }
    }

    private async Task AttachAsync(BrowserCommandModel command)
    {
        var paneId = command.Pane ?? throw new InvalidOperationException("Identifiant de pane manquant.");
        if (_views.ContainsKey(paneId))
        {
            return;
        }

        var environment = _environment() ?? throw new InvalidOperationException("Tily démarre encore : réessayez dans un instant.");
        var view = new BrowserView(paneId, BrowserViewports.Parse(command.Viewport), _callbacks);
        _views[paneId] = view;
        _layer.Children.Add(view.Control);
        try
        {
            await view.InitializeAsync(environment, BrowserAddress.IsAllowed(command.Url) ? command.Url! : BrowserAddress.Blank, command.Shortcuts);
        }
        catch (Exception exception) when (exception is COMException or InvalidOperationException or ArgumentException)
        {
            Close(paneId);
            _post(new { type = "browser.failed", pane = paneId, message = $"Le navigateur n’a pas pu démarrer : {exception.Message}" });
        }
    }

    private static object? Navigate(BrowserView view, string url)
    {
        view.Navigate(url);
        return null;
    }

    private static object? Reload(BrowserView view)
    {
        view.Reload();
        return null;
    }

    private static BrowserLogLevel Level(string? level) => level switch
    {
        null or "" or "log" => BrowserLogLevel.Log,
        "debug" => BrowserLogLevel.Debug,
        "warn" => BrowserLogLevel.Warn,
        "error" => BrowserLogLevel.Error,
        _ => throw new InvalidOperationException($"Niveau inconnu : « {level} ». Choisissez debug, log, warn ou error.")
    };

    private BrowserView? Find(BrowserCommandModel command) => command.Pane is { } paneId && _views.TryGetValue(paneId, out var view) ? view : null;

    private BrowserView Require(BrowserCommandModel command) =>
        Find(command) is { Ready: true } view ? view : throw new InvalidOperationException("Ce pane navigateur n’a pas encore démarré : affichez-le d’abord (tily_focus).");

    private void Close(string? paneId)
    {
        if (paneId is not null && _views.Remove(paneId, out var view))
        {
            _layer.Children.Remove(view.Control);
            view.Dispose();
        }
    }

    private void PostState(BrowserView view) => _post(new { type = "browser.state", state = view.State() });

    private void PostNewPane(BrowserView view, string url) => _post(new { type = "browser.newPane", pane = view.PaneId, url });

    private void PostFocused(BrowserView view) => _post(new { type = "browser.focused", pane = view.PaneId });

    private void PostKey(BrowserView view, JsonElement key)
    {
        _focusInterface();
        _post(new { type = "browser.key", pane = view.PaneId, key });
    }

    public void Dispose()
    {
        foreach (var paneId in _views.Keys.ToList())
        {
            Close(paneId);
        }
    }
}

internal sealed class BrowserCommandModel
{
    public required string Type { get; init; }
    public string? Pane { get; init; }
    public string? Url { get; init; }
    public string? Viewport { get; init; }
    public string? Level { get; init; }
    public string? Shortcuts { get; init; }
    public double X { get; init; }
    public double Y { get; init; }
    public double Width { get; init; }
    public double Height { get; init; }
    public bool Visible { get; init; }
    public bool SinceLoad { get; init; }
    public bool FailedOnly { get; init; }
    public bool FullPage { get; init; }
    public int Limit { get; init; }
    public int Request { get; init; }
}

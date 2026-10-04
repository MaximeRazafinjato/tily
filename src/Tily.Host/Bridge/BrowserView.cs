using System.Text.Json;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.Web.WebView2.Core;
using Tily.Core.Browser;
using Windows.Foundation;

namespace Tily.Host.Bridge;

internal sealed class BrowserView : IDisposable
{
    public const string ProfileName = "browser";
    private const double OffscreenLeft = -20000;
    private static readonly TimeSpan ErrorsDelay = TimeSpan.FromMilliseconds(250);
    private static readonly string[] ConsoleEvents = [DevToolsConsole.ConsoleApiCalled, DevToolsConsole.ExceptionThrown, DevToolsConsole.EntryAdded];

    private readonly BrowserCallbacks _callbacks;
    private readonly DevToolsNetwork _network = new();
    private readonly List<BrowserNavigationWaiter> _navigations = [];
    private readonly List<CoreWebView2DevToolsProtocolEventReceiver> _receivers = [];
    private CoreWebView2? _core;
    private Rect _bounds;
    private bool _visible;
    private bool _capturing;
    private readonly DispatcherQueueTimer _errorsTimer;
    private bool _focusPending;
    private bool _errorsScheduled;
    private int _lastErrors;

    public BrowserView(string paneId, BrowserViewport viewport, BrowserCallbacks callbacks)
    {
        PaneId = paneId;
        Viewport = viewport;
        _callbacks = callbacks;
        Control = new WebView2 { Visibility = Visibility.Collapsed, DefaultBackgroundColor = Microsoft.UI.Colors.White };
        Control.GotFocus += (_, _) => _callbacks.Focused(this);
        _errorsTimer = Control.DispatcherQueue.CreateTimer();
        _errorsTimer.Interval = ErrorsDelay;
        _errorsTimer.IsRepeating = false;
        _errorsTimer.Tick += (_, _) => PostErrorsNow();
    }

    public string PaneId { get; }

    public WebView2 Control { get; }

    public BrowserLog Log { get; } = new();

    public BrowserViewport Viewport { get; private set; }

    public bool Ready => _core is not null;

    public bool Loading { get; private set; }

    public async Task InitializeAsync(CoreWebView2Environment environment, string url, string? shortcutLetters)
    {
        var options = environment.CreateCoreWebView2ControllerOptions();
        options.ProfileName = ProfileName;
        await Control.EnsureCoreWebView2Async(environment, options);
        var core = Control.CoreWebView2;
        core.Settings.IsGeneralAutofillEnabled = true;
        core.Settings.IsPasswordAutosaveEnabled = true;
        core.NavigationStarting += HandleNavigationStarting;
        core.NavigationCompleted += HandleNavigationCompleted;
        core.SourceChanged += (_, _) => PostState();
        core.DocumentTitleChanged += (_, _) => PostState();
        core.HistoryChanged += (_, _) => PostState();
        core.NewWindowRequested += HandleNewWindowRequested;
        core.WebMessageReceived += HandleWebMessage;
        foreach (var name in ConsoleEvents)
        {
            var receiver = core.GetDevToolsProtocolEventReceiver(name);
            receiver.DevToolsProtocolEventReceived += (_, args) => ReceiveConsole(name, args.ParameterObjectAsJson);
            _receivers.Add(receiver);
        }

        foreach (var name in DevToolsNetwork.Events)
        {
            var receiver = core.GetDevToolsProtocolEventReceiver(name);
            receiver.DevToolsProtocolEventReceived += (_, args) => ReceiveNetwork(name, args.ParameterObjectAsJson);
            _receivers.Add(receiver);
        }

        await core.AddScriptToExecuteOnDocumentCreatedAsync(BrowserPageScript.Keys(shortcutLetters));
        await BrowserDevTools.EnableAsync(core);
        _core = core;
        await ApplyViewportAsync();
        core.Navigate(url);
    }

    public void SetBounds(Rect bounds, bool visible)
    {
        _bounds = bounds;
        _visible = visible;
        if (!_capturing)
        {
            Layout();
        }
    }

    public async Task SetViewportAsync(BrowserViewport viewport)
    {
        Viewport = viewport;
        Layout();
        await ApplyViewportAsync();
        PostState();
    }

    public void Navigate(string url) => _core?.Navigate(url);

    public Task<BrowserNavigationModel> NavigateAsync(string url, TimeSpan timeout) => WaitForNavigationAsync(() => Require().Navigate(url), timeout);

    public Task<BrowserNavigationModel> ReloadAsync(TimeSpan timeout) => WaitForNavigationAsync(() => Require().Reload(), timeout);

    public void Back()
    {
        if (_core?.CanGoBack == true)
        {
            _core.GoBack();
        }
    }

    public void Reload() => _core?.Reload();

    public void OpenDevTools() => _core?.OpenDevToolsWindow();

    public void Focus()
    {
        _focusPending = Control.Visibility != Visibility.Visible;
        if (!_focusPending)
        {
            Control.Focus(FocusState.Programmatic);
        }
    }

    public BrowserStateModel State() => new(
        PaneId,
        _core?.Source ?? string.Empty,
        _core?.DocumentTitle ?? string.Empty,
        Loading,
        _core?.CanGoBack ?? false,
        _core?.CanGoForward ?? false,
        Log.ErrorCount(),
        BrowserViewports.Name(Viewport));

    public async Task<BrowserCaptureModel> CaptureAsync(BrowserViewport viewport, bool fullPage)
    {
        var core = Require();
        var size = BrowserViewports.Capture(viewport);
        _capturing = true;
        try
        {
            if (!_visible)
            {
                Canvas.SetLeft(Control, OffscreenLeft);
                Control.Width = size.Width;
                Control.Height = size.Height;
                Control.Visibility = Visibility.Visible;
            }

            await BrowserDevTools.EmulateAsync(core, size);
            await BrowserDevTools.SettleAsync(core);
            var (width, height) = fullPage ? await BrowserDevTools.ContentSizeAsync(core) : (size.Width, size.Height);
            var data = await BrowserDevTools.ScreenshotAsync(core, width, height, fullPage);
            return new BrowserCaptureModel(data, width, height, size.Scale, BrowserViewports.Name(viewport), core.Source, core.DocumentTitle);
        }
        finally
        {
            _capturing = false;
            await ApplyViewportAsync();
            Layout();
        }
    }

    public async Task<string> SnapshotAsync() => Control.Visibility == Visibility.Visible ? await BrowserDevTools.PreviewAsync(Require()) : string.Empty;

    private async Task ApplyViewportAsync()
    {
        if (_core is not null)
        {
            await BrowserDevTools.ApplyPaneViewportAsync(_core, Viewport);
        }
    }

    private void Layout()
    {
        var width = Viewport == BrowserViewport.Mobile ? Math.Min(BrowserViewports.MobilePaneWidth, _bounds.Width) : _bounds.Width;
        Canvas.SetLeft(Control, _bounds.X + (_bounds.Width - width) / 2);
        Canvas.SetTop(Control, _bounds.Y);
        Control.Width = Math.Max(0, width);
        Control.Height = Math.Max(0, _bounds.Height);
        Control.Visibility = _visible && _bounds.Width > 0 && _bounds.Height > 0 ? Visibility.Visible : Visibility.Collapsed;
        if (_focusPending && Control.Visibility == Visibility.Visible)
        {
            _focusPending = false;
            Control.Focus(FocusState.Programmatic);
        }
    }

    private async Task<BrowserNavigationModel> WaitForNavigationAsync(Action start, TimeSpan timeout)
    {
        var waiter = new BrowserNavigationWaiter();
        _navigations.Add(waiter);
        start();
        try
        {
            return await waiter.Completion.Task.WaitAsync(timeout);
        }
        catch (TimeoutException)
        {
            return new BrowserNavigationModel(_core?.Source ?? string.Empty, _core?.DocumentTitle ?? string.Empty, false, null, "La page n’a pas fini de charger dans le délai imparti.", Log.ErrorCount());
        }
        finally
        {
            _navigations.Remove(waiter);
        }
    }

    private void HandleNavigationStarting(CoreWebView2 sender, CoreWebView2NavigationStartingEventArgs args)
    {
        foreach (var waiter in _navigations.Where(waiter => waiter.NavigationId is null))
        {
            waiter.NavigationId = args.NavigationId;
        }

        Loading = true;
        Log.StartLoad();
        _lastErrors = 0;
        PostState();
    }

    private void HandleNavigationCompleted(CoreWebView2 sender, CoreWebView2NavigationCompletedEventArgs args)
    {
        Loading = false;
        var status = args.HttpStatusCode > 0 ? args.HttpStatusCode : (int?)null;
        var error = args.IsSuccess ? null : $"Chargement impossible : {args.WebErrorStatus}.";
        var result = new BrowserNavigationModel(sender.Source, sender.DocumentTitle, args.IsSuccess, status, error, Log.ErrorCount());
        foreach (var waiter in _navigations.Where(waiter => waiter.NavigationId == args.NavigationId).ToList())
        {
            waiter.Completion.TrySetResult(result);
        }

        PostState();
    }

    private void HandleNewWindowRequested(CoreWebView2 sender, CoreWebView2NewWindowRequestedEventArgs args)
    {
        if (args.WindowFeatures.HasSize || args.WindowFeatures.HasPosition)
        {
            return;
        }

        args.Handled = true;
        if (BrowserAddress.IsAllowed(args.Uri))
        {
            _callbacks.NewPane(this, args.Uri);
        }
    }

    private void HandleWebMessage(CoreWebView2 sender, CoreWebView2WebMessageReceivedEventArgs args)
    {
        try
        {
            using var document = JsonDocument.Parse(args.WebMessageAsJson);
            var root = document.RootElement;
            if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("type", out var type) && type.GetString() == BrowserPageScript.KeyMessage)
            {
                _callbacks.Key(this, root.Clone());
            }
        }
        catch (JsonException)
        {
        }
    }

    private void ReceiveConsole(string name, string json)
    {
        try
        {
            if (DevToolsConsole.Parse(name, json) is { } message)
            {
                Log.AddConsole(message);
                PostErrorsIfChanged();
            }
        }
        catch (Exception exception) when (exception is JsonException or KeyNotFoundException or InvalidOperationException)
        {
        }
    }

    private void ReceiveNetwork(string name, string json)
    {
        try
        {
            if (_network.Handle(name, json) is not { } finished)
            {
                return;
            }

            var entry = Log.AddNetwork(finished.Entry);
            PostErrorsIfChanged();
            if (finished.NeedsBody)
            {
                _ = AttachBodyAsync(entry.Sequence, finished.RequestId);
            }
        }
        catch (Exception exception) when (exception is JsonException or KeyNotFoundException or InvalidOperationException)
        {
        }
    }

    private async Task AttachBodyAsync(long sequence, string requestId)
    {
        try
        {
            if (await BrowserDevTools.ResponseBodyAsync(Require(), requestId) is { } body)
            {
                Log.AttachBody(sequence, body);
            }
        }
        catch (Exception exception) when (exception is JsonException or InvalidOperationException or System.Runtime.InteropServices.COMException or ArgumentException)
        {
        }
    }

    private void PostErrorsIfChanged()
    {
        if (!_errorsScheduled)
        {
            _errorsScheduled = true;
            _errorsTimer.Start();
        }
    }

    private void PostErrorsNow()
    {
        _errorsScheduled = false;
        var errors = Log.ErrorCount();
        if (errors != _lastErrors)
        {
            _lastErrors = errors;
            PostState();
        }
    }

    private void PostState() => _callbacks.StateChanged(this);

    private CoreWebView2 Require() => _core ?? throw new InvalidOperationException("Le navigateur de ce pane démarre encore : réessayez dans un instant.");

    public void Dispose()
    {
        foreach (var waiter in _navigations.ToList())
        {
            waiter.Completion.TrySetException(new InvalidOperationException("Le pane navigateur a été fermé."));
        }

        _errorsTimer.Stop();
        Control.Close();
    }
}

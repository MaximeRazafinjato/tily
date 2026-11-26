using System.ComponentModel;
using System.Runtime.InteropServices;
using Microsoft.Web.WebView2.Core;
using Tily.Core.Activity;
using Tily.Core.Terminal;

namespace Tily.Host.Bridge;

public sealed class ActivityFeed : IDisposable
{
    private static readonly TimeSpan SampleInterval = TimeSpan.FromSeconds(2);

    private readonly TerminalManager _terminals;
    private readonly ProcessUsageSampler _sampler = new(new WindowsProcessProbe());
    private readonly HashSet<HostBridge> _subscribers = [];
    private readonly Dictionary<HostBridge, CoreWebView2Environment> _environments = [];
    private readonly object _gate = new();
    private readonly Timer _timer;
    private bool _disposed;
    private volatile IReadOnlyDictionary<int, string> _webViewRoles = new Dictionary<int, string>();

    public ActivityFeed(TerminalManager terminals)
    {
        _terminals = terminals;
        _timer = new Timer(_ => Sample());
    }

    public void Handle(BridgeCommandModel command, HostBridge window)
    {
        switch (command.Type)
        {
            case "activity.subscribe":
                Subscribe(window);
                break;
            case "activity.unsubscribe":
                Unsubscribe(window);
                break;
            default:
                throw new InvalidOperationException($"Commande inconnue : {command.Type}");
        }
    }

    public void Unsubscribe(HostBridge window)
    {
        lock (_gate)
        {
            if (_subscribers.Remove(window) && _subscribers.Count == 0 && !_disposed)
            {
                _timer.Change(Timeout.InfiniteTimeSpan, Timeout.InfiniteTimeSpan);
            }
        }

        if (_environments.Remove(window, out var environment))
        {
            environment.ProcessInfosChanged -= HandleProcessInfosChanged;
        }
    }

    private void Subscribe(HostBridge window)
    {
        lock (_gate)
        {
            if (_subscribers.Add(window) && !_disposed)
            {
                _timer.Change(TimeSpan.Zero, SampleInterval);
            }
        }

        if (window.WebViewEnvironment is { } environment && _environments.TryAdd(window, environment))
        {
            environment.ProcessInfosChanged += HandleProcessInfosChanged;
            _ = RefreshWebViewRolesAsync(environment);
        }
    }

    private void HandleProcessInfosChanged(CoreWebView2Environment sender, object args) => _ = RefreshWebViewRolesAsync(sender);

    private async Task RefreshWebViewRolesAsync(CoreWebView2Environment environment)
    {
        try
        {
            _webViewRoles = await WebViewProcessRoles.ReadAsync(environment);
        }
        catch (Exception exception) when (exception is COMException or InvalidOperationException)
        {
        }
    }

    private void Sample()
    {
        lock (_gate)
        {
            if (_disposed || _subscribers.Count == 0)
            {
                return;
            }

            try
            {
                var activity = _sampler.Sample(_terminals.ProcessIds(), Environment.ProcessId, _webViewRoles);
                var message = new { type = "activity.state", panes = activity.Panes, host = activity.Host };
                foreach (var window in _subscribers)
                {
                    window.Post(message);
                }
            }
            catch (Exception exception) when (exception is Win32Exception or InvalidOperationException or ObjectDisposedException)
            {
            }
        }
    }

    public void Dispose()
    {
        lock (_gate)
        {
            _disposed = true;
            _subscribers.Clear();
        }

        _timer.Dispose();
    }
}

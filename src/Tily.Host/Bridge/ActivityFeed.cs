using System.ComponentModel;
using Tily.Core.Activity;
using Tily.Core.Terminal;

namespace Tily.Host.Bridge;

public sealed class ActivityFeed : IDisposable
{
    private static readonly TimeSpan SampleInterval = TimeSpan.FromSeconds(2);

    private readonly TerminalManager _terminals;
    private readonly ProcessUsageSampler _sampler = new(new WindowsProcessProbe());
    private readonly HashSet<HostBridge> _subscribers = [];
    private readonly object _gate = new();
    private readonly Timer _timer;
    private bool _disposed;

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
                var activity = _sampler.Sample(_terminals.ProcessIds(), Environment.ProcessId);
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

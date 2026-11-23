using System.ComponentModel;
using Tily.Core.Activity;
using Tily.Core.Terminal;

namespace Tily.Host.Bridge;

public sealed class ActivityFeed : IDisposable
{
    private static readonly TimeSpan SampleInterval = TimeSpan.FromSeconds(2);

    private readonly TerminalManager _terminals;
    private readonly Action<object> _post;
    private readonly ProcessUsageSampler _sampler = new(new WindowsProcessProbe());
    private readonly object _gate = new();
    private readonly Timer _timer;
    private bool _disposed;

    public ActivityFeed(TerminalManager terminals, Action<object> post)
    {
        _terminals = terminals;
        _post = post;
        _timer = new Timer(_ => Sample());
    }

    public void Handle(BridgeCommandModel command)
    {
        switch (command.Type)
        {
            case "activity.subscribe":
                _timer.Change(TimeSpan.Zero, SampleInterval);
                break;
            case "activity.unsubscribe":
                _timer.Change(Timeout.InfiniteTimeSpan, Timeout.InfiniteTimeSpan);
                break;
            default:
                throw new InvalidOperationException($"Commande inconnue : {command.Type}");
        }
    }

    private void Sample()
    {
        lock (_gate)
        {
            if (_disposed)
            {
                return;
            }

            try
            {
                var activity = _sampler.Sample(_terminals.ProcessIds(), Environment.ProcessId);
                _post(new { type = "activity.state", panes = activity.Panes, host = activity.Host });
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
        }

        _timer.Dispose();
    }
}

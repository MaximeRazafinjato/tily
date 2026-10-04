using Tily.Core.Agents;

namespace Tily.Host.Bridge;

public sealed class PreviewRequestFeed : IDisposable
{
    private static readonly TimeSpan ChangeDelay = TimeSpan.FromMilliseconds(150);

    private readonly PreviewRequestRepository _requests;
    private readonly Func<string, bool> _ownsPane;
    private readonly Action<object> _post;
    private readonly FileSystemWatcher _watcher;
    private readonly Timer _timer;
    private readonly object _sync = new();
    private bool _disposed;

    public PreviewRequestFeed(string dataDirectory, Func<string, bool> ownsPane, Action<object> post)
    {
        _ownsPane = ownsPane;
        _post = post;
        _requests = new PreviewRequestRepository(dataDirectory);
        Directory.CreateDirectory(_requests.Directory);
        _timer = new Timer(_ => Deliver());
        _watcher = new FileSystemWatcher(_requests.Directory, "*.json") { NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite };
        _watcher.Created += HandleChanged;
        _watcher.Changed += HandleChanged;
        _watcher.Renamed += HandleChanged;
        _watcher.EnableRaisingEvents = true;
    }

    private void HandleChanged(object sender, FileSystemEventArgs args) => _timer.Change(ChangeDelay, Timeout.InfiniteTimeSpan);

    private void Deliver()
    {
        lock (_sync)
        {
            if (_disposed)
            {
                return;
            }

            try
            {
                foreach (var request in _requests.TakeOwned(_ownsPane))
                {
                    _post(new { type = "preview.requested", pane = request.PaneId, path = request.Path });
                }
            }
            catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
            {
            }
        }
    }

    public void Dispose()
    {
        _watcher.Dispose();
        _timer.Dispose();
        lock (_sync)
        {
            _disposed = true;
        }
    }
}

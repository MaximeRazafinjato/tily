namespace Tily.Host.Bridge;

public sealed class PreferencesWatcher : IDisposable
{
    private static readonly TimeSpan ChangeDelay = TimeSpan.FromMilliseconds(300);

    private readonly FileSystemWatcher _watcher;
    private readonly Timer _timer;

    public PreferencesWatcher(string dataDirectory, Action changed)
    {
        _timer = new Timer(_ => changed());
        _watcher = new FileSystemWatcher(dataDirectory, "*.json") { NotifyFilter = NotifyFilters.LastWrite | NotifyFilters.FileName, IncludeSubdirectories = false };
        _watcher.Changed += HandleChanged;
        _watcher.Created += HandleChanged;
        _watcher.Deleted += HandleChanged;
        _watcher.Renamed += HandleChanged;
        _watcher.EnableRaisingEvents = true;
    }

    public void RetrySoon() => _timer.Change(ChangeDelay, Timeout.InfiniteTimeSpan);

    private void HandleChanged(object sender, FileSystemEventArgs args) => RetrySoon();

    public void Dispose()
    {
        _watcher.Dispose();
        _timer.Dispose();
    }
}

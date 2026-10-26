using System.ComponentModel;
using System.Text.Json;
using Tily.Core.Git;

namespace Tily.Host.Bridge;

public sealed class ExplorerGitMarks : IDisposable
{
    private readonly GitRunner _runner = new();
    private readonly Action<object> _post;
    private readonly BackgroundQueue _queue;
    private readonly object _sync = new();
    private string _folder = string.Empty;
    private GitLocationModel? _location;
    private string? _displayRoot;
    private GitWatcher? _watcher;
    private string? _lastMarks;
    private int _refreshQueued;

    public ExplorerGitMarks(Action<object> post, Action<Exception> onError)
    {
        _post = post;
        _queue = new BackgroundQueue(onError);
    }

    public void Follow(string folder)
    {
        lock (_sync)
        {
            if (string.Equals(_folder, folder, StringComparison.Ordinal))
            {
                return;
            }

            _folder = folder;
        }

        _queue.Enqueue(() => Locate(folder, false));
    }

    public void Refresh()
    {
        string folder;
        lock (_sync)
        {
            folder = _folder;
        }

        _queue.Enqueue(() => Locate(folder, true));
    }

    private void Locate(string folder, bool force)
    {
        var location = LocationOf(folder);
        var displayRoot = location is null ? null : DisplayRootOf(folder, location);
        lock (_sync)
        {
            if (!string.Equals(_folder, folder, StringComparison.Ordinal))
            {
                return;
            }

            if (force || !string.Equals(location?.Root, _location?.Root, StringComparison.OrdinalIgnoreCase) || !string.Equals(displayRoot, _displayRoot, StringComparison.OrdinalIgnoreCase))
            {
                _watcher?.Dispose();
                _watcher = location is null ? null : new GitWatcher(location, _ => ScheduleMarks());
                _location = location;
                _displayRoot = displayRoot;
                _lastMarks = null;
            }
        }

        PostMarks();
    }

    private void ScheduleMarks()
    {
        if (Interlocked.Exchange(ref _refreshQueued, 1) == 0)
        {
            _queue.Enqueue(() =>
            {
                Interlocked.Exchange(ref _refreshQueued, 0);
                PostMarks();
            });
        }
    }

    private GitLocationModel? LocationOf(string folder)
    {
        if (folder.Length == 0 || !GitRunner.IsInstalled)
        {
            return null;
        }

        try
        {
            return GitRepository.Locate(_runner, folder);
        }
        catch (Exception exception) when (IsGitFailure(exception))
        {
            return null;
        }
    }

    private string DisplayRootOf(string folder, GitLocationModel location) => GitPathMarks.DisplayRootFrom(_runner, folder, location.Root);

    private void PostMarks()
    {
        GitLocationModel? location;
        string? displayRoot;
        lock (_sync)
        {
            (location, displayRoot) = (_location, _displayRoot);
        }

        var marks = location is null || displayRoot is null ? [] : Read(location, displayRoot);
        var json = JsonSerializer.Serialize(marks);
        lock (_sync)
        {
            if (!ReferenceEquals(location, _location) || json == _lastMarks)
            {
                return;
            }

            _lastMarks = json;
        }

        _post(new { type = "files.gitMarks", root = displayRoot, marks });
    }

    private IReadOnlyList<GitPathMarkModel> Read(GitLocationModel location, string displayRoot)
    {
        if (!Directory.Exists(location.Root))
        {
            return [];
        }

        try
        {
            return GitPathMarks.From(displayRoot, new GitRepository(_runner, location).Status(int.MaxValue));
        }
        catch (Exception exception) when (IsGitFailure(exception))
        {
            return [];
        }
    }

    private static bool IsGitFailure(Exception exception) => exception is GitCommandException or Win32Exception or IOException or InvalidOperationException;

    public void Dispose()
    {
        lock (_sync)
        {
            _watcher?.Dispose();
            _watcher = null;
            _location = null;
        }
    }
}

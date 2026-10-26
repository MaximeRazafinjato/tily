using System.Diagnostics;
using Tily.Core.Git;

namespace Tily.Host.Bridge;

[Flags]
public enum GitChangeScope
{
    None = 0,
    WorkingTree = 1,
    Repository = 2
}

public sealed record GitChangeModel(GitChangeScope Scope, long LastEvent);

public sealed class GitWatcher : IDisposable
{
    private const int BufferSize = 64 * 1024;
    private static readonly TimeSpan ChangeDelay = TimeSpan.FromMilliseconds(300);
    private static readonly HashSet<string> GitEntries = new(StringComparer.OrdinalIgnoreCase)
    {
        "HEAD", "index", "packed-refs", "refs", "MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "REBASE_HEAD", "rebase-merge", "rebase-apply"
    };

    private const string WorktreesEntry = "worktrees";
    private const string IndexEntry = "index";
    private static readonly HashSet<string> WorktreeEntries = new(StringComparer.OrdinalIgnoreCase) { "HEAD", "locked", "gitdir" };

    private readonly string[] _gitDirectories;
    private readonly List<FileSystemWatcher> _watchers = [];
    private readonly Action<GitChangeModel> _changed;
    private readonly Timer _timer;
    private int _scheduled;
    private int _scope;
    private long _lastEvent;
    private bool _disposed;

    public GitWatcher(GitLocationModel location, Action<GitChangeModel> changed)
    {
        _changed = changed;
        _gitDirectories = [location.GitDirectory, location.CommonDirectory];
        _timer = new Timer(_ => Fire());
        foreach (var directory in new[] { location.Root, location.GitDirectory, location.CommonDirectory }.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (directory == location.Root || !IsWithin(directory, location.Root))
            {
                Add(directory);
            }
        }
    }

    private void Add(string directory)
    {
        try
        {
            var watcher = new FileSystemWatcher(directory)
            {
                IncludeSubdirectories = true,
                InternalBufferSize = BufferSize,
                NotifyFilter = NotifyFilters.FileName | NotifyFilters.DirectoryName | NotifyFilters.LastWrite | NotifyFilters.Size
            };
            watcher.Changed += (_, args) => Signal(args.FullPath);
            watcher.Created += (_, args) => Signal(args.FullPath);
            watcher.Deleted += (_, args) => Signal(args.FullPath);
            watcher.Renamed += (_, args) => Signal(args.FullPath);
            watcher.Error += (_, _) => Schedule(GitChangeScope.Repository);
            watcher.EnableRaisingEvents = true;
            _watchers.Add(watcher);
        }
        catch (Exception exception) when (exception is ArgumentException or IOException or UnauthorizedAccessException)
        {
        }
    }

    private void Signal(string path)
    {
        var scope = ScopeOf(path);
        if (scope != GitChangeScope.None)
        {
            Schedule(scope);
        }
    }

    private void Schedule(GitChangeScope scope)
    {
        Interlocked.Or(ref _scope, (int)scope);
        Volatile.Write(ref _lastEvent, Stopwatch.GetTimestamp());
        if (Volatile.Read(ref _disposed) || Interlocked.Exchange(ref _scheduled, 1) != 0)
        {
            return;
        }

        try
        {
            _timer.Change(ChangeDelay, Timeout.InfiniteTimeSpan);
        }
        catch (ObjectDisposedException)
        {
        }
    }

    private void Fire()
    {
        Interlocked.Exchange(ref _scheduled, 0);
        var scope = (GitChangeScope)Interlocked.Exchange(ref _scope, 0);
        if (scope != GitChangeScope.None && !Volatile.Read(ref _disposed))
        {
            _changed(new GitChangeModel(scope, Volatile.Read(ref _lastEvent)));
        }
    }

    private GitChangeScope ScopeOf(string path)
    {
        var gitDirectory = _gitDirectories.FirstOrDefault(directory => IsWithin(path, directory));
        if (gitDirectory is null)
        {
            return GitChangeScope.WorkingTree;
        }

        var relative = Path.GetRelativePath(gitDirectory, path);
        var parts = relative.Split(Path.DirectorySeparatorChar);
        if (relative.EndsWith(".lock", StringComparison.OrdinalIgnoreCase))
        {
            return GitChangeScope.None;
        }

        var relevant = string.Equals(parts[0], WorktreesEntry, StringComparison.OrdinalIgnoreCase)
            ? parts.Length <= 2 || WorktreeEntries.Contains(parts[2])
            : GitEntries.Contains(parts[0]);
        if (!relevant)
        {
            return GitChangeScope.None;
        }

        return string.Equals(parts[0], IndexEntry, StringComparison.OrdinalIgnoreCase) ? GitChangeScope.WorkingTree : GitChangeScope.Repository;
    }

    private static bool IsWithin(string path, string directory) =>
        path.StartsWith(directory.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)
        || string.Equals(path, directory, StringComparison.OrdinalIgnoreCase);

    public void Dispose()
    {
        Volatile.Write(ref _disposed, true);
        _timer.Dispose();
        foreach (var watcher in _watchers)
        {
            watcher.Dispose();
        }
    }
}

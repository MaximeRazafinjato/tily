using System.Diagnostics;
using System.Text.Json;
using Tily.Core.Git;
using Tily.Core.Session;
using Tily.Core.StatusLog;

namespace Tily.Host.Bridge;

public sealed class GitFeed : IDisposable
{
    private const string MissingGit = "Git est introuvable : installez Git pour Windows ou ajoutez git.exe au PATH.";

    private readonly Action<object> _post;
    private readonly GitRunner _runner = new();
    private readonly BackgroundQueue _reads;
    private readonly BackgroundQueue _lookups;
    private readonly GitOperationRunner _operations;
    private readonly Func<bool> _autoFetch;
    private readonly object _sync = new();
    private string _path = string.Empty;
    private GitLocationModel? _location;
    private GitWatcher? _watcher;
    private GitHistoryScope _scope = GitHistoryScope.All;
    private int _historyCount = GitHistoryReader.PageSize;
    private string? _lastState;
    private string? _lastSignature;
    private string? _displayRoot;
    private GitStateModel? _lastModel;
    private GitUndoRecordModel? _lastUndo;
    private long _statusReadAt;
    private long _repositoryReadAt;
    private int _pendingRefresh;

    public GitFeed(Action<object> post, Func<bool> autoFetch, Action<Exception> onError)
    {
        _post = post;
        _autoFetch = autoFetch;
        _reads = new BackgroundQueue(onError);
        _lookups = new BackgroundQueue(onError);
        _operations = new GitOperationRunner(Open, post, ScheduleRefresh, onError);
    }

    public void Handle(BridgeCommandModel command)
    {
        if (_operations.Handle(command))
        {
            return;
        }

        switch (command.Type)
        {
            case "git.watch":
                Watch(command.Path ?? string.Empty);
                break;
            case "git.refresh":
                _reads.Enqueue(() => Refresh(true, true));
                break;
            case "git.init":
                var folder = command.Path ?? throw new InvalidOperationException("Chemin manquant.");
                _reads.Enqueue(() => Initialize(folder));
                break;
            case "git.history":
                ChangeHistory(command.Scope, command.Count);
                break;
            case "git.diff":
                Read(command, "git.diff", repository => GitDiffReader.Read(repository, DiffRequest(command)));
                break;
            case "git.details":
                Read(command, "git.details", repository => GitDiffReader.ReadCommit(repository, command.Commit));
                break;
            default:
                throw new InvalidOperationException($"Commande inconnue : {command.Type}");
        }
    }

    private void Watch(string path)
    {
        lock (_sync)
        {
            _path = path;
        }

        _reads.Enqueue(() => Follow(path));
    }

    private void Follow(string path)
    {
        GitLocationModel? location;
        var displayRead = path.Length == 0 ? null : Task.Run(() => GitPathMarks.DisplayRootFrom(_runner, path, string.Empty));
        try
        {
            location = path.Length == 0 ? null : GitRepository.Locate(_runner, path);
        }
        catch (GitCommandException exception)
        {
            _post(new { type = "git.state", path, error = UserErrorMessage.Of(exception) });
            return;
        }

        var displayRoot = displayRead?.GetAwaiter().GetResult() is { Length: > 0 } shown ? shown : location?.Root;
        bool followed;
        lock (_sync)
        {
            if (_path != path)
            {
                return;
            }

            followed = location?.Root != _location?.Root;
            if (followed)
            {
                _watcher?.Dispose();
                _watcher = location is null ? null : new GitWatcher(location, Changed);
                _location = location;
                _historyCount = GitHistoryReader.PageSize;
                _lastState = null;
                _lastSignature = null;
                _lastModel = null;
                _lastUndo = null;
            }

            _displayRoot = displayRoot;
        }

        if (path.Length == 0)
        {
            return;
        }

        if (location is null)
        {
            _post(new { type = "git.state", path, error = GitRunner.IsInstalled ? Inaccessible(path) : MissingGit });
            return;
        }

        Refresh(true, false);
        if (followed && _autoFetch())
        {
            _operations.AutoFetch(location.Root);
        }
    }

    private void Initialize(string path)
    {
        try
        {
            if (Inaccessible(path) is { } problem)
            {
                _post(new { type = "git.state", path, error = problem });
                return;
            }

            if (GitRepository.Locate(_runner, path) is null)
            {
                GitRepository.Require(_runner.Run(path, ["init"]), $"Initialisation d’un dépôt Git impossible dans {path}.");
            }
        }
        catch (GitCommandException exception)
        {
            _post(new { type = "git.state", path, error = UserErrorMessage.Of(exception) });
            return;
        }

        if (GitRepository.Locate(_runner, path) is null)
        {
            _post(new { type = "git.state", path, error = Inaccessible(path) ?? $"Le dépôt créé dans {path} reste illisible par Git." });
            return;
        }

        Follow(path);
    }

    private string? Inaccessible(string path) =>
        GitRepository.AccessProblem(_runner, path) is { } problem ? $"Dépôt Git illisible dans {path} : {problem}" : null;

    public void RefreshSoon() => ScheduleRefresh(GitChangeScope.Repository);

    private void Changed(GitChangeModel change)
    {
        lock (_sync)
        {
            var readAt = change.Scope.HasFlag(GitChangeScope.Repository) ? _repositoryReadAt : _statusReadAt;
            if (change.LastEvent < readAt)
            {
                return;
            }
        }

        ScheduleRefresh(change.Scope);
    }

    private void ScheduleRefresh(GitChangeScope scope)
    {
        if (Interlocked.Or(ref _pendingRefresh, (int)scope) == 0)
        {
            _reads.Enqueue(() =>
            {
                var pending = (GitChangeScope)Interlocked.Exchange(ref _pendingRefresh, 0);
                Refresh(false, false, true, pending == GitChangeScope.WorkingTree);
            });
        }
    }

    private void MarkRead(GitChangeScope scope)
    {
        var now = Stopwatch.GetTimestamp();
        lock (_sync)
        {
            _statusReadAt = now;
            _repositoryReadAt = scope == GitChangeScope.Repository ? now : _repositoryReadAt;
        }
    }

    private void Refresh(bool forceState, bool forceHistory, bool announceUnchanged = false, bool workingTreeOnly = false)
    {
        GitLocationModel? location;
        string path;
        GitHistoryScope scope;
        int count;
        string? displayRoot;
        GitStateModel? previous;
        GitUndoRecordModel? previousUndo;
        lock (_sync)
        {
            (location, path, scope, count, displayRoot, previous, previousUndo) = (_location, _path, _scope, _historyCount, _displayRoot, _lastModel, _lastUndo);
        }

        if (location is null || path.Length == 0)
        {
            return;
        }

        var repository = new GitRepository(_runner, location);
        var undo = _operations.Journal.Get(location.Root);
        bool ForceAllowed(string branch) => _operations.IsForceAllowed(location.Root, branch);
        GitStateModel state;
        try
        {
            MarkRead(GitChangeScope.WorkingTree);
            var workingTree = workingTreeOnly && previous is not null ? GitStateReader.ReadWorkingTree(repository, previous, previousUndo, undo, ForceAllowed) : null;
            if (workingTree is null)
            {
                MarkRead(GitChangeScope.Repository);
            }

            state = workingTree ?? GitStateReader.Read(repository, undo, ForceAllowed);
        }
        catch (GitCommandException exception)
        {
            _post(new { type = "git.state", path, error = UserErrorMessage.Of(exception) });
            return;
        }

        var json = JsonSerializer.Serialize(state, SessionRepository.JsonOptions);
        var signature = $"{GitStateReader.Signature(state)}\n{scope}\n{count}";
        bool postState;
        bool postHistory;
        lock (_sync)
        {
            if (!ReferenceEquals(location, _location))
            {
                return;
            }

            postState = forceState || json != _lastState;
            postHistory = forceState || forceHistory || signature != _lastSignature;
            (_lastState, _lastSignature, _lastModel, _lastUndo) = (json, signature, state, undo);
        }

        if (postState)
        {
            _post(new { type = "git.state", path, state, displayRoot = displayRoot ?? location.Root });
        }
        else if (announceUnchanged)
        {
            _post(new { type = "git.changed", path });
        }

        if (postHistory)
        {
            PostHistory(repository, state, scope, count);
        }
    }

    private void PostHistory(GitRepository repository, GitStateModel state, GitHistoryScope scope, int count)
    {
        try
        {
            _post(new { type = "git.history", history = GitHistoryReader.Read(repository, scope, count, state) });
        }
        catch (GitCommandException exception)
        {
            _post(new { type = "git.history", history = GitHistoryReader.Empty(repository.Root, scope), error = UserErrorMessage.Of(exception) });
        }
    }

    private void ChangeHistory(string? scope, int count)
    {
        lock (_sync)
        {
            _scope = scope == "current" ? GitHistoryScope.Current : GitHistoryScope.All;
            _historyCount = Math.Clamp(count, GitHistoryReader.PageSize, GitHistoryReader.MaxCommits);
        }

        _reads.Enqueue(RefreshHistory);
    }

    private void RefreshHistory()
    {
        GitLocationModel? location;
        GitStateModel? state;
        GitHistoryScope scope;
        int count;
        lock (_sync)
        {
            (location, state, scope, count) = (_location, _lastModel, _scope, _historyCount);
            if (location is not null && state is not null)
            {
                _lastSignature = $"{GitStateReader.Signature(state)}\n{scope}\n{count}";
            }
        }

        if (location is null || state is null)
        {
            Refresh(false, true);
            return;
        }

        PostHistory(new GitRepository(_runner, location), state, scope, count);
    }

    private void Read(BridgeCommandModel command, string type, Func<GitRepository, object> read) =>
        _lookups.Enqueue(() =>
        {
            try
            {
                _post(new { type, request = command.Request, result = read(Open(command.Path)) });
            }
            catch (Exception exception) when (exception is GitCommandException or IOException or UnauthorizedAccessException)
            {
                _post(new { type, request = command.Request, error = UserErrorMessage.Of(exception) });
            }
        });

    private GitRepository Open(string? path)
    {
        lock (_sync)
        {
            if (_location is { } location && string.Equals(location.Root, path, StringComparison.OrdinalIgnoreCase))
            {
                return new GitRepository(_runner, location);
            }
        }

        return GitRepository.Open(_runner, path ?? string.Empty);
    }

    private static GitDiffRequestModel DiffRequest(BridgeCommandModel command)
    {
        var source = command.Source switch
        {
            "staged" => GitDiffSource.Staged,
            "commit" => GitDiffSource.Commit,
            _ => GitDiffSource.Unstaged
        };
        return new GitDiffRequestModel(source, command.File ?? string.Empty, command.OldFile, command.Commit, command.Untracked);
    }

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

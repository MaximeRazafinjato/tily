using System.Collections.Concurrent;
using Tily.Core.Git;
using Tily.Core.StatusLog;

namespace Tily.Host.Bridge;

public sealed class GitOperationRunner
{
    private readonly Func<string?, GitRepository> _open;
    private readonly Action<object> _post;
    private readonly Action<GitChangeScope> _completed;
    private readonly BackgroundQueue _queue;
    private static readonly HashSet<string> WorkingTreeOperations = ["git.stage", "git.unstage", "git.discard", "git.stageLines", "git.unstageLines", "git.discardLines", "git.ignore", "git.resolve"];

    private readonly ConcurrentDictionary<string, byte> _forceAllowed = new(StringComparer.OrdinalIgnoreCase);
    private readonly GitAutoFetchSchedule _autoFetches = new();

    public GitOperationRunner(Func<string?, GitRepository> open, Action<object> post, Action<GitChangeScope> completed, Action<Exception> onError)
    {
        _open = open;
        _post = post;
        _completed = completed;
        _queue = new BackgroundQueue(onError);
    }

    public GitUndoJournal Journal { get; } = new();

    public bool IsForceAllowed(string root, string branch) => _forceAllowed.ContainsKey(ForceKey(root, branch));

    public bool Handle(BridgeCommandModel command)
    {
        var files = command.Files ?? [];
        Func<GitRepository, GitOutcomeModel>? action = command.Type switch
        {
            "git.stage" => repository => GitChangeCommands.Stage(repository, files),
            "git.unstage" => repository => GitChangeCommands.Unstage(repository, files),
            "git.discard" => repository => GitChangeCommands.Discard(repository, files, command.Confirmed),
            "git.stageLines" => repository => GitLineCommands.Apply(repository, GitLineAction.Stage, LineRequest(command), false),
            "git.unstageLines" => repository => GitLineCommands.Apply(repository, GitLineAction.Unstage, LineRequest(command), false),
            "git.discardLines" => repository => GitLineCommands.Apply(repository, GitLineAction.Discard, LineRequest(command), command.Confirmed),
            "git.commit" => repository => CommitThenPush(repository, command),
            "git.push" => repository => Push(repository, command.Force, command.Confirmed),
            "git.pushBranch" => repository => PushUpTo(repository, command.Branch, command.Commit),
            "git.pull" => GitSyncCommands.Pull,
            "git.fetch" => Fetch,
            "git.merge" => repository => GitHistoryCommands.Merge(repository, command.Reference),
            "git.rebase" => repository => GitHistoryCommands.Rebase(repository, command.Reference),
            "git.cherryPick" => repository => GitHistoryCommands.CherryPick(repository, command.Commit),
            "git.revert" => repository => GitHistoryCommands.Revert(repository, command.Commit),
            "git.reset" => repository => GitHistoryCommands.Reset(repository, command.Commit, command.Mode, command.Confirmed),
            "git.switch" => repository => GitBranchCommands.Switch(repository, command.Reference, command.Target),
            "git.branchCreate" => repository => GitBranchCommands.Create(repository, command.Name, command.Reference, command.Checkout),
            "git.branchRename" => repository => GitBranchCommands.Rename(repository, command.Name, command.NewName),
            "git.branchDelete" => repository => GitBranchCommands.Delete(repository, command.Name, command.Force, command.Confirmed),
            "git.remoteBranchDelete" => repository => GitSyncCommands.DeleteRemoteBranch(repository, command.Reference, command.Confirmed),
            "git.refsDelete" => repository => GitRefDeleteCommands.Delete(repository, new GitRefDeletionModel(command.Branches ?? [], command.RemoteBranches ?? [], command.Tags ?? [], command.Stashes ?? []), command.Confirmed),
            "git.tagCreate" => repository => GitStashTagCommands.CreateTag(repository, command.Name, command.Commit),
            "git.tagDelete" => repository => GitStashTagCommands.DeleteTag(repository, command.Name),
            "git.tagPush" => repository => GitSyncCommands.PushTag(repository, command.Name),
            "git.stash" => repository => GitStashTagCommands.Stash(repository, command.Message, files),
            "git.ignore" => repository => GitChangeCommands.Ignore(repository, files),
            "git.stashApply" => repository => GitStashTagCommands.ApplyStash(repository, command.Index, command.Commit, command.Pop),
            "git.stashDrop" => repository => GitStashTagCommands.DropStash(repository, command.Index, command.Commit, command.Confirmed),
            "git.resolve" => repository => GitChangeCommands.Resolve(repository, files, command.Confirmed),
            "git.continue" => repository => GitChangeCommands.Continue(repository, Journal.Get(repository.Root)),
            "git.abort" => repository => GitChangeCommands.Abort(repository, command.Confirmed),
            "git.undo" => repository => GitUndo.Apply(repository, Journal.Get(repository.Root)),
            _ => null
        };
        if (action is null)
        {
            return false;
        }

        _queue.Enqueue(() => Run(command, action));
        return true;
    }

    private void Run(BridgeCommandModel command, Func<GitRepository, GitOutcomeModel> action)
    {
        GitRepository? repository = null;
        try
        {
            repository = _open(command.Path);
            var outcome = action(repository);
            Journal.Apply(repository.Root, outcome);
            _post(new { type = "git.done", operation = command.Type, message = outcome.Message, warning = outcome.Warning, output = outcome.Output });
        }
        catch (GitPushRejectedException rejected)
        {
            _forceAllowed[ForceKey(repository!.Root, rejected.Branch)] = 0;
            _post(new { type = "git.pushRejected", operation = command.Type, branch = rejected.Branch, message = rejected.Message, output = rejected.Output });
        }
        catch (GitCommandException failure)
        {
            _post(new { type = "git.failed", operation = command.Type, message = failure.Message, output = failure.Output.Length > 0 ? failure.Output : null, code = failure.Code == GitFailureCode.None ? (GitFailureCode?)null : failure.Code });
        }
        catch (Exception exception)
        {
            _post(new { type = "git.failed", operation = command.Type, message = UserErrorMessage.Of(exception) });
        }
        finally
        {
            _completed(WorkingTreeOperations.Contains(command.Type) ? GitChangeScope.WorkingTree : GitChangeScope.Repository);
        }
    }

    public void AutoFetch(string root)
    {
        if (_autoFetches.TryStart(root, DateTimeOffset.UtcNow))
        {
            _queue.Enqueue(() => RunAutoFetch(root));
        }
    }

    private void RunAutoFetch(string root)
    {
        try
        {
            var repository = _open(root);
            if (repository.Remotes().Count == 0)
            {
                return;
            }

            _post(new { type = "git.autoFetchStarted", path = repository.Root });
            try
            {
                GitSyncCommands.Fetch(repository);
            }
            finally
            {
                _post(new { type = "git.autoFetchEnded", path = repository.Root });
                _completed(GitChangeScope.Repository);
            }
        }
        catch (Exception exception) when (exception is GitCommandException or IOException or UnauthorizedAccessException)
        {
        }
    }

    private GitOutcomeModel Fetch(GitRepository repository)
    {
        var outcome = GitSyncCommands.Fetch(repository);
        _autoFetches.Record(repository.Root, DateTimeOffset.UtcNow);
        return outcome;
    }

    private GitOutcomeModel CommitThenPush(GitRepository repository, BridgeCommandModel command)
    {
        var committed = GitChangeCommands.Commit(repository, command.Message, command.Amend);
        if (!command.Push)
        {
            return committed;
        }

        Journal.Apply(repository.Root, committed);
        try
        {
            return new GitOutcomeModel($"{committed.Message} {Push(repository, false, false).Message}");
        }
        catch (GitCommandException failure) when (failure is not GitPushRejectedException)
        {
            return new GitOutcomeModel($"{committed.Message} Push impossible : {failure.Message}", true, Output: failure.Output.Length > 0 ? failure.Output : null);
        }
    }

    private GitOutcomeModel Push(GitRepository repository, bool force, bool confirmed)
    {
        var key = ForceKey(repository.Root, repository.CurrentBranch() ?? string.Empty);
        var outcome = GitSyncCommands.Push(repository, force, confirmed, _forceAllowed.ContainsKey(key));
        _forceAllowed.TryRemove(key, out _);
        return outcome;
    }

    private GitOutcomeModel PushUpTo(GitRepository repository, string? branch, string? commit)
    {
        var outcome = GitSyncCommands.PushUpTo(repository, branch, commit);
        _forceAllowed.TryRemove(ForceKey(repository.Root, branch ?? string.Empty), out _);
        return outcome;
    }

    private static string ForceKey(string root, string branch) => $"{root}\n{branch}";

    private static GitLineRequestModel LineRequest(BridgeCommandModel command) => new(command.File, command.Untracked, command.Fingerprint, command.Selection ?? []);
}

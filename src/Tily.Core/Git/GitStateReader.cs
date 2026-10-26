using Tily.Core.Worktrees;

namespace Tily.Core.Git;

public static class GitStateReader
{
    public static GitStateModel Read(GitRepository repository, GitUndoRecordModel? undo, Func<string, bool> forcePushAllowed)
    {
        var refsRead = Task.Run(() => GitRefsReader.Read(repository));
        var stashesRead = Task.Run(() => GitRefsReader.ReadStashes(repository));
        var messageRead = Task.Run(() => repository.Run("log", "-1", "--no-show-signature", "--format=%B", "HEAD"));
        var worktreesRead = Task.Run(() => WorktreeLister.TryList(repository));
        var publication = GitUndo.StartPublicationCheck(repository, undo);
        var status = repository.Status();
        var operation = repository.Operation();
        var refs = refsRead.GetAwaiter().GetResult();
        var stashes = stashesRead.GetAwaiter().GetResult();
        var lastMessage = status.Head.Unborn ? null : GitRepository.Require(messageRead.GetAwaiter().GetResult(), "La commande « git log » a échoué.").TrimEnd();
        var name = Path.GetFileName(repository.Root.TrimEnd(Path.DirectorySeparatorChar));
        return new GitStateModel(
            repository.Root,
            name.Length > 0 ? name : repository.Root,
            status.Head,
            operation,
            status.Staged,
            status.Unstaged,
            status.Conflicts,
            status.StagedTotal,
            status.UnstagedTotal,
            refs.Branches,
            refs.RemoteBranches,
            refs.Tags,
            stashes,
            refs.Remotes,
            lastMessage,
            GitUndo.Describe(repository, undo, status.Head, operation, publication),
            status.Head.Branch is { } branch && forcePushAllowed(branch),
            worktreesRead.GetAwaiter().GetResult());
    }

    public static GitStateModel? ReadWorkingTree(GitRepository repository, GitStateModel previous, GitUndoRecordModel? previousUndo, GitUndoRecordModel? undo, Func<string, bool> forcePushAllowed)
    {
        var status = repository.Status();
        var operation = repository.Operation();
        if (status.Head != previous.Head || operation != previous.Operation)
        {
            return null;
        }

        return previous with
        {
            Staged = status.Staged,
            Unstaged = status.Unstaged,
            Conflicts = status.Conflicts,
            StagedTotal = status.StagedTotal,
            UnstagedTotal = status.UnstagedTotal,
            Undo = ReferenceEquals(undo, previousUndo) ? previous.Undo : GitUndo.Describe(repository, undo, status.Head, operation),
            ForcePushAllowed = status.Head.Branch is { } branch && forcePushAllowed(branch)
        };
    }

    public static string Signature(GitStateModel state) =>
        string.Join('\n', new[] { state.Head.Sha ?? string.Empty, state.Head.Branch ?? string.Empty, state.Head.Upstream ?? string.Empty }
            .Concat(state.Branches.Select(branch => $"{branch.Name} {branch.Sha}"))
            .Concat(state.RemoteBranches.Select(branch => $"{branch.Name} {branch.Sha}"))
            .Concat(state.Tags.Select(tag => $"{tag.Name} {tag.Sha}"))
            .Concat(state.Stashes.Select(stash => $"stash {stash.Sha}")));
}

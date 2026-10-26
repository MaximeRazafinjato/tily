namespace Tily.Core.Git;

public static class GitHistoryCommands
{
    public static GitOutcomeModel Merge(GitRepository repository, string? reference)
    {
        var target = GitNames.RequireRevision(reference);
        var (head, branch) = RequireTarget(repository, target);
        var before = head ?? throw new GitCommandException("Aucun commit sur la branche courante.", string.Empty);
        var output = repository.Run("merge", "--no-edit", target);
        return Conclude(repository, output, new GitUndoRecordModel { Kind = GitUndoKind.Merge, Label = $"Merge de « {target} »", HeadBefore = before, BranchBefore = branch },
            $"Merge de « {target} » dans « {branch ?? "HEAD"} » terminé.", "Le merge a échoué.", "Merge interrompu");
    }

    public static GitOutcomeModel Rebase(GitRepository repository, string? reference)
    {
        var target = GitNames.RequireRevision(reference);
        var (head, current) = RequireTarget(repository, target);
        var branch = current ?? throw new GitCommandException("HEAD détachée : faites le checkout d’une branche avant le rebase.", string.Empty);
        var before = head ?? throw new GitCommandException("Aucun commit sur la branche courante.", string.Empty);
        var output = repository.Run("rebase", target);
        return Conclude(repository, output, new GitUndoRecordModel { Kind = GitUndoKind.Rebase, Label = $"Rebase sur « {target} »", HeadBefore = before, BranchBefore = branch },
            $"Rebase de « {branch} » sur « {target} » terminé.", "Le rebase a échoué.", "Rebase interrompu");
    }

    public static GitOutcomeModel CherryPick(GitRepository repository, string? commit)
    {
        var (sha, isMerge, before, branch) = RequirePick(repository, commit);
        var output = isMerge ? repository.Run("cherry-pick", "-m", "1", sha) : repository.Run("cherry-pick", sha);
        return Conclude(repository, output, new GitUndoRecordModel { Kind = GitUndoKind.CherryPick, Label = $"Cherry-pick de {GitRepository.Short(sha)}", HeadBefore = before, BranchBefore = branch },
            $"Cherry-pick de {GitRepository.Short(sha)} sur « {branch ?? "HEAD"} » terminé.", "Le cherry-pick a échoué.", "Cherry-pick interrompu");
    }

    public static GitOutcomeModel Revert(GitRepository repository, string? commit)
    {
        var (sha, isMerge, before, branch) = RequirePick(repository, commit);
        var output = isMerge ? repository.Run("revert", "--no-edit", "-m", "1", sha) : repository.Run("revert", "--no-edit", sha);
        if (!output.Succeeded && repository.Operation() is null && repository.HeadSha() == before && IsClean(repository.Status()))
        {
            return new GitOutcomeModel($"Rien à défaire : les modifications de {GitRepository.Short(sha)} sont déjà absentes de « {branch ?? "HEAD"} ».");
        }

        return Conclude(repository, output, new GitUndoRecordModel { Kind = GitUndoKind.Revert, Label = $"Revert de {GitRepository.Short(sha)}", HeadBefore = before, BranchBefore = branch },
            $"Revert de {GitRepository.Short(sha)} sur « {branch ?? "HEAD"} » terminé.", "Le revert a échoué.", "Revert interrompu");
    }

    public static GitOutcomeModel Reset(GitRepository repository, string? commit, string? mode, bool confirmed)
    {
        var sha = repository.RequireCommit(commit);
        var kind = mode switch
        {
            "soft" => GitUndoKind.ResetSoft,
            "mixed" => GitUndoKind.ResetMixed,
            "hard" => GitUndoKind.ResetHard,
            _ => throw new GitCommandException($"Mode de reset inconnu : {mode}.", string.Empty)
        };
        if (kind == GitUndoKind.ResetHard)
        {
            GitPaths.RequireConfirmation(confirmed);
        }

        repository.RequireNoOperation();
        var (head, branch) = repository.HeadAndBranch();
        var before = head ?? throw new GitCommandException("Aucun commit sur la branche courante.", string.Empty);
        var indexTree = kind == GitUndoKind.ResetMixed ? GitRepository.ValueOf(repository.Run("write-tree")) : null;
        var backup = kind == GitUndoKind.ResetHard ? GitRepository.ValueOf(repository.Run("stash", "create")) : null;
        GitRepository.Require(repository.Run("reset", $"--{mode}", "-q", sha), "Le reset a échoué.");
        var record = new GitUndoRecordModel
        {
            Kind = kind,
            Label = $"Reset {mode} vers {GitRepository.Short(sha)}",
            HeadBefore = before,
            HeadAfter = sha,
            BranchBefore = branch,
            BranchAfter = branch,
            IndexTree = indexTree,
            Backup = backup
        };
        return new GitOutcomeModel($"Reset {mode} de « {branch ?? "HEAD"} » vers {GitRepository.Short(sha)} terminé.", Undo: record);
    }

    private static (string? Head, string? Branch) RequireTarget(GitRepository repository, string target)
    {
        var targetRead = Task.Run(() => repository.RequireCommit(target));
        var head = repository.HeadAndBranch();
        targetRead.GetAwaiter().GetResult();
        repository.RequireNoOperation();
        return head;
    }

    private static (string Sha, bool IsMerge, string Before, string? Branch) RequirePick(GitRepository repository, string? commit)
    {
        var commitRead = Task.Run(() => repository.RequireCommitAndParents(commit));
        var (head, branch) = repository.HeadAndBranch();
        var (sha, parents) = commitRead.GetAwaiter().GetResult();
        repository.RequireNoOperation();
        var before = head ?? throw new GitCommandException("Aucun commit sur la branche courante.", string.Empty);
        return (sha, parents.Count > 1, before, branch);
    }

    private static bool IsClean(GitStatusModel status) =>
        status.Staged.Count == 0 && status.Conflicts.Count == 0 && status.Unstaged.All(change => change.Kind == GitChangeKind.Untracked);

    private static GitOutcomeModel Conclude(GitRepository repository, GitOutputModel output, GitUndoRecordModel pending, string success, string failure, string interrupted)
    {
        if (!output.Succeeded)
        {
            if (repository.Operation() is null)
            {
                throw new GitCommandException(failure, output.Details);
            }

            var conflicts = repository.Status().Conflicts.Count;
            return new GitOutcomeModel($"{interrupted} : {GitText.Count(conflicts, "fichier en conflit", "fichiers en conflit")}.", true, pending with { Pending = true });
        }

        var (after, branch) = repository.HeadAndBranch();
        if (after is null || after == pending.HeadBefore)
        {
            return new GitOutcomeModel("Déjà à jour : rien à faire.");
        }

        return new GitOutcomeModel(success, Undo: pending with { HeadAfter = after, BranchAfter = branch, Published = repository.IsPublished(after) });
    }
}

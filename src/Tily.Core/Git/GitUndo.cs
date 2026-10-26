namespace Tily.Core.Git;

public static class GitUndo
{
    private static readonly HashSet<GitUndoKind> HeadKinds =
    [
        GitUndoKind.Commit, GitUndoKind.Amend, GitUndoKind.Merge, GitUndoKind.Pull, GitUndoKind.Rebase, GitUndoKind.CherryPick, GitUndoKind.Revert,
        GitUndoKind.ResetSoft, GitUndoKind.ResetMixed, GitUndoKind.ResetHard, GitUndoKind.Switch
    ];

    private static readonly HashSet<GitUndoKind> RewritingKinds = [GitUndoKind.Commit, GitUndoKind.Amend, GitUndoKind.Merge, GitUndoKind.Rebase, GitUndoKind.CherryPick, GitUndoKind.Revert];

    public static Task<bool>? StartPublicationCheck(GitRepository repository, GitUndoRecordModel? record) =>
        record is { Published: false, HeadAfter: { } after } && RewritingKinds.Contains(record.Kind) ? Task.Run(() => repository.IsPublished(after)) : null;

    public static GitUndoInfoModel? Describe(GitRepository repository, GitUndoRecordModel? record, GitHeadModel head, GitOperationKind? operation, Task<bool>? publication = null)
    {
        if (record is null)
        {
            return null;
        }

        var reason = Blocker(repository, record, head, operation, publication);
        return new GitUndoInfoModel(record.Label, reason is null, reason);
    }

    public static GitOutcomeModel Apply(GitRepository repository, GitUndoRecordModel? record)
    {
        if (record is null)
        {
            throw new GitCommandException("Aucune opération à annuler.", string.Empty);
        }

        var reason = Blocker(repository, record, repository.Status().Head, repository.Operation());
        if (reason is not null)
        {
            throw new GitCommandException($"Annulation impossible : {reason}.", string.Empty);
        }

        Restore(repository, record, $"L’annulation de « {record.Label} » a échoué.");
        return new GitOutcomeModel($"Annulé : {record.Label}.", ClearUndo: true);
    }

    private static void Restore(GitRepository repository, GitUndoRecordModel record, string failure)
    {
        switch (record.Kind)
        {
            case GitUndoKind.Commit or GitUndoKind.Amend:
                GitRepository.Require(record.HeadBefore is null ? repository.Run("update-ref", "-d", "HEAD") : repository.Run("reset", "--soft", record.HeadBefore), failure);
                break;
            case GitUndoKind.Merge or GitUndoKind.Pull or GitUndoKind.Rebase or GitUndoKind.CherryPick or GitUndoKind.Revert:
                GitRepository.Require(repository.Run("reset", "--keep", record.HeadBefore!), $"{failure} Des modifications locales gênent : faites un stash ou un commit.");
                break;
            case GitUndoKind.ResetSoft:
                GitRepository.Require(repository.Run("reset", "--soft", record.HeadBefore!), failure);
                break;
            case GitUndoKind.ResetMixed:
                GitRepository.Require(repository.Run("reset", "--soft", record.HeadBefore!), failure);
                GitRepository.Require(record.IndexTree is null ? repository.Run("reset", "-q", "--mixed", record.HeadBefore!) : repository.Run("read-tree", record.IndexTree), failure);
                break;
            case GitUndoKind.ResetHard:
                UndoHardReset(repository, record, failure);
                break;
            case GitUndoKind.Switch:
                SwitchBack(repository, record, failure);
                DeleteBranch(repository, record.RefName, failure);
                break;
            case GitUndoKind.BranchCreate:
                if (record.BranchAfter is not null)
                {
                    SwitchBack(repository, record, failure);
                }

                DeleteBranch(repository, record.RefName, failure);
                break;
            case GitUndoKind.BranchDelete:
                GitRepository.Require(repository.Run("branch", record.RefName!, record.RefTarget!), failure);
                if (record.Upstream is not null)
                {
                    repository.Run("branch", "-q", $"--set-upstream-to={record.Upstream}", record.RefName!);
                }

                break;
            case GitUndoKind.BranchRename:
                var caseOnly = string.Equals(record.RefName, record.NewName, StringComparison.OrdinalIgnoreCase);
                GitRepository.Require(repository.Run("branch", caseOnly ? "-M" : "-m", record.NewName!, record.RefName!), failure);
                break;
            case GitUndoKind.TagCreate:
                GitRepository.Require(repository.Run("tag", "-d", record.RefName!), failure);
                break;
            case GitUndoKind.TagDelete:
                GitRepository.Require(repository.Run("update-ref", $"refs/tags/{record.RefName}", record.RefTarget!), failure);
                break;
            case GitUndoKind.StashPush:
                if (!repository.Run("stash", "pop", "--index", "-q").Succeeded)
                {
                    GitRepository.Require(repository.Run("stash", "pop", "-q"), failure);
                }

                break;
            case GitUndoKind.StashDrop:
                GitRepository.Require(repository.Run("stash", "store", "-m", record.StashMessage ?? string.Empty, record.Backup!), failure);
                break;
            case GitUndoKind.Discard:
                RestoreFiles(repository, record.Files);
                break;
            case GitUndoKind.RefsDelete:
                foreach (var step in record.Steps.Reverse())
                {
                    Restore(repository, step, failure);
                }

                break;
        }
    }

    private static string? Blocker(GitRepository repository, GitUndoRecordModel record, GitHeadModel head, GitOperationKind? operation, Task<bool>? publication = null)
    {
        if (operation is not null)
        {
            return "une opération est en cours";
        }

        if (record.Pending)
        {
            return "l’opération a été terminée hors de Tily";
        }

        if (HeadKinds.Contains(record.Kind))
        {
            if (head.Sha != record.HeadAfter || head.Branch != record.BranchAfter)
            {
                return "le dépôt a changé depuis cette opération";
            }

            if (record.HeadBefore is null && record.Kind is not (GitUndoKind.Commit or GitUndoKind.Amend))
            {
                return "aucun état antérieur à restaurer";
            }

            return RewritingKinds.Contains(record.Kind) && !record.Published && record.HeadAfter is not null && (publication?.GetAwaiter().GetResult() ?? repository.IsPublished(record.HeadAfter))
                ? "un push a déjà publié les commits"
                : null;
        }

        return record.Kind switch
        {
            GitUndoKind.BranchCreate when repository.Resolve($"refs/heads/{record.RefName}") != record.RefTarget => "la branche a changé depuis",
            GitUndoKind.BranchCreate when record.BranchAfter is not null && head.Branch != record.BranchAfter => "vous avez changé de branche depuis",
            GitUndoKind.BranchDelete when repository.RefValue($"refs/heads/{record.RefName}") is not null => "une branche du même nom existe de nouveau",
            GitUndoKind.BranchRename when repository.RefValue($"refs/heads/{record.NewName}") is null => "la branche a changé depuis",
            GitUndoKind.TagCreate when repository.RefValue($"refs/tags/{record.RefName}") != record.RefTarget => "le tag a changé depuis",
            GitUndoKind.TagDelete when repository.RefValue($"refs/tags/{record.RefName}") is not null => "un tag du même nom existe de nouveau",
            GitUndoKind.StashPush when repository.RefValue("refs/stash") != record.Backup => "la liste des stashes a changé depuis",
            GitUndoKind.RefsDelete => record.Steps.Select(step => Blocker(repository, step, head, operation)).FirstOrDefault(reason => reason is not null),
            _ => null
        };
    }

    private static void UndoHardReset(GitRepository repository, GitUndoRecordModel record, string failure)
    {
        GitRepository.Require(repository.Run("reset", "--hard", "-q", record.HeadBefore!), failure);
        if (record.Backup is not null && !repository.Run("stash", "apply", "--index", record.Backup).Succeeded)
        {
            GitRepository.Require(repository.Run("stash", "apply", record.Backup), $"Le commit est restauré, mais les modifications locales n’ont pas pu être réappliquées (sauvegarde {record.Backup}).");
        }
    }

    private static void SwitchBack(GitRepository repository, GitUndoRecordModel record, string failure)
    {
        var output = record.BranchBefore is not null
            ? repository.Run("switch", record.BranchBefore)
            : record.HeadBefore is not null ? repository.Run("switch", "--detach", record.HeadBefore) : throw new GitCommandException($"{failure} Aucun état antérieur à restaurer.", string.Empty);
        GitRepository.Require(output, failure);
    }

    private static void DeleteBranch(GitRepository repository, string? name, string failure)
    {
        if (name is not null)
        {
            GitRepository.Require(repository.Run("branch", "-D", name), failure);
        }
    }

    private static void RestoreFiles(GitRepository repository, IReadOnlyList<GitDiscardedFileModel> files)
    {
        var current = GitPaths.Hash(repository, files.Select(file => file.Path).Where(path => File.Exists(repository.FullPath(path))).ToList(), false);
        var changed = files.FirstOrDefault(file => current.GetValueOrDefault(file.Path) != file.After);
        if (changed is not null)
        {
            throw new GitCommandException($"Annulation impossible : « {changed.Path} » a été modifié depuis l’abandon.", string.Empty);
        }

        foreach (var file in files)
        {
            var path = repository.FullPath(file.Path);
            if (file.Blob is null)
            {
                File.Delete(path);
                continue;
            }

            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.WriteAllBytes(path, repository.ReadBytes("cat-file", "blob", file.Blob));
        }
    }
}

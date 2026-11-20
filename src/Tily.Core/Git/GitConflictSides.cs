namespace Tily.Core.Git;

public static class GitConflictSides
{
    private const string BranchPrefix = "refs/heads/";
    private static readonly string[] RebaseFolders = ["rebase-merge", "rebase-apply"];

    public static GitConflictSidesModel Read(GitRepository repository)
    {
        var current = repository.CurrentBranch() ?? GitRepository.Short(repository.HeadSha());
        return repository.Operation() switch
        {
            GitOperationKind.Merge => new GitConflictSidesModel(current, BranchOrCommit(repository, repository.RefValue("MERGE_HEAD"), current)),
            GitOperationKind.Rebase => Rebase(repository, current),
            GitOperationKind.CherryPick => new GitConflictSidesModel(current, Commit(repository, "CHERRY_PICK_HEAD")),
            GitOperationKind.Revert => new GitConflictSidesModel(current, Commit(repository, "REVERT_HEAD") is { } reverted ? $"revert de {reverted}" : null),
            _ => new GitConflictSidesModel(current, null)
        };
    }

    private static GitConflictSidesModel Rebase(GitRepository repository, string current)
    {
        var folder = RebaseFolders.Select(name => Path.Combine(repository.Location.GitDirectory, name)).FirstOrDefault(Directory.Exists);
        var onto = folder is null ? null : FileValue(Path.Combine(folder, "onto"));
        var headName = folder is null ? null : FileValue(Path.Combine(folder, "head-name"));
        var rebased = headName is not null && headName.StartsWith(BranchPrefix, StringComparison.Ordinal) ? headName[BranchPrefix.Length..] : null;
        return new GitConflictSidesModel(BranchOrCommit(repository, onto, rebased) ?? current, rebased ?? Commit(repository, "REBASE_HEAD"));
    }

    private static string? BranchOrCommit(GitRepository repository, string? sha, string? excluded)
    {
        if (sha is null)
        {
            return null;
        }

        var names = repository.Run("for-each-ref", "--points-at", sha, "--format=%(refname:short)", "refs/heads", "refs/remotes").Output
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return names.FirstOrDefault(name => name != excluded && !name.EndsWith("/HEAD", StringComparison.Ordinal)) ?? GitRepository.Short(sha);
    }

    private static string? Commit(GitRepository repository, string reference) =>
        repository.RefValue(reference) is { } sha ? GitRepository.Short(sha) : null;

    private static string? FileValue(string path) =>
        File.Exists(path) && File.ReadAllText(path).Trim() is { Length: > 0 } value ? value : null;
}

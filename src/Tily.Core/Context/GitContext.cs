namespace Tily.Core.Context;

public sealed record GitContextModel(bool IsRepository, string? Branch, bool DetachedHead, string? WorktreeRoot = null)
{
    public static readonly GitContextModel None = new(false, null, false);
}

public static class GitContext
{
    private const string GitEntry = ".git";
    private const string GitDirPrefix = "gitdir:";
    private const string RefPrefix = "ref: refs/heads/";
    private const string WorktreesFolder = "worktrees";

    public static GitContextModel Resolve(string path)
    {
        var (gitDirectory, worktreeRoot, _) = FindRepository(path);
        if (gitDirectory is null)
        {
            return GitContextModel.None;
        }

        var headPath = Path.Combine(gitDirectory, "HEAD");
        if (!File.Exists(headPath))
        {
            return GitContextModel.None;
        }

        var head = File.ReadAllText(headPath).Trim();
        return head.StartsWith(RefPrefix, StringComparison.Ordinal)
            ? new GitContextModel(true, head[RefPrefix.Length..], false, worktreeRoot)
            : new GitContextModel(true, null, true, worktreeRoot);
    }

    public static string? MainRepositoryRoot(string path)
    {
        var (gitDirectory, worktreeRoot, repositoryRoot) = FindRepository(path);
        if (gitDirectory is null)
        {
            return null;
        }

        return worktreeRoot is null ? repositoryRoot : Directory.GetParent(gitDirectory)?.Parent?.Parent?.FullName ?? repositoryRoot;
    }

    private static (string? GitDirectory, string? WorktreeRoot, string? RepositoryRoot) FindRepository(string path)
    {
        var current = Directory.Exists(path) ? new DirectoryInfo(path) : null;
        while (current is not null)
        {
            var entry = Path.Combine(current.FullName, GitEntry);
            if (Directory.Exists(entry))
            {
                return (entry, null, current.FullName);
            }

            if (File.Exists(entry))
            {
                var resolved = ResolveGitFile(entry, current.FullName);
                var linked = resolved is not null && string.Equals(Path.GetFileName(Path.GetDirectoryName(resolved)), WorktreesFolder, StringComparison.OrdinalIgnoreCase);
                return (resolved, linked ? current.FullName : null, current.FullName);
            }

            current = current.Parent;
        }

        return (null, null, null);
    }

    private static string? ResolveGitFile(string gitFile, string baseDirectory)
    {
        var line = File.ReadLines(gitFile).FirstOrDefault(candidate => candidate.StartsWith(GitDirPrefix, StringComparison.Ordinal));
        if (line is null)
        {
            return null;
        }

        var target = line[GitDirPrefix.Length..].Trim();
        var resolved = Path.GetFullPath(Path.IsPathRooted(target) ? target : Path.Combine(baseDirectory, target));
        return Directory.Exists(resolved) ? resolved : null;
    }
}

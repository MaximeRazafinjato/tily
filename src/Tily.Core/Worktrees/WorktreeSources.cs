using Tily.Core.Git;

namespace Tily.Core.Worktrees;

public sealed record WorktreeSourcesModel(string Project, IReadOnlyList<string> Repositories, string? Selected, string? DefaultRepository);

public static class WorktreeSources
{
    public static WorktreeSourcesModel Resolve(GitRunner runner, string path, bool fromProject, IReadOnlyList<string> projectsRoots, string worktreeFolder, Func<string, string?> remembered)
    {
        var mainRoot = fromProject ? null : MainRootOf(runner, path);
        var project = fromProject ? WorktreeLister.NormalizePath(path) : ProjectOf(mainRoot ?? path, projectsRoots, worktreeFolder);
        var stored = remembered(project) is { } repository && Directory.Exists(repository) ? WorktreeLister.NormalizePath(repository) : null;
        var found = RepositoryFinder.Find(project);
        var defaultRepository = stored ?? found.FirstOrDefault();
        var selected = mainRoot ?? defaultRepository;
        var repositories = found
            .Concat(new[] { stored, selected }.OfType<string>())
            .DistinctBy(candidate => candidate, StringComparer.OrdinalIgnoreCase)
            .ToList();
        return new WorktreeSourcesModel(project, repositories, selected, defaultRepository);
    }

    public static string ProjectOf(string folder, IReadOnlyList<string> projectsRoots, string worktreeFolder)
    {
        var normalized = WorktreeLister.NormalizePath(folder);
        var root = ProjectsRootOf(normalized, projectsRoots);
        if (root is null || WorktreeTarget.IsWithin(normalized, worktreeFolder))
        {
            return normalized;
        }

        var first = Path.GetRelativePath(root, normalized).Split(Path.DirectorySeparatorChar)[0];
        return Path.Combine(root, first);
    }

    public static string? ProjectsRootOf(string folder, IReadOnlyList<string> projectsRoots) =>
        projectsRoots
            .Where(root => Path.IsPathFullyQualified(root) && WorktreeTarget.IsWithin(folder, root) && !WorktreeTarget.SamePath(folder, root))
            .Select(WorktreeLister.NormalizePath)
            .MaxBy(root => root.Length);

    private static string? MainRootOf(GitRunner runner, string path)
    {
        var location = GitRepository.Locate(runner, path);
        if (location is null)
        {
            return null;
        }

        var repository = new GitRepository(runner, location);
        return WorktreeTarget.MainRoot(repository, WorktreeLister.TryList(repository));
    }
}

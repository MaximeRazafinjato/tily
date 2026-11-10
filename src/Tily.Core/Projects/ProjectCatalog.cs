using Tily.Core.Worktrees;

namespace Tily.Core.Projects;

public sealed record ProjectModel(string Name, string Path, bool Worktree = false);

public sealed record ProjectListModel(string Root, IReadOnlyList<ProjectModel> Projects, string? Error, IReadOnlyList<string> AdditionalRoots);

public static class ProjectCatalog
{
    public const string DefaultRoot = @"C:\Files\Projects";
    public const string ExcludedFolder = "worktrees";

    private const string GitEntry = ".git";

    public static ProjectListModel List(string root, string? worktreeFolder = null, IReadOnlyList<WorktreeProjectFolderModel>? projectFolders = null, IReadOnlyList<string>? additionalRoots = null)
    {
        var worktrees = worktreeFolder ?? Path.Combine(root, ExcludedFolder);
        var dedicated = (projectFolders ?? []).Where(entry => !SamePath(entry.Folder, entry.Project)).Select(entry => entry.Folder).ToList();
        var others = additionalRoots ?? [];
        var errors = new List<string>();
        var projects = new[] { root }.Concat(others).SelectMany(folder => ProjectsOf(folder, worktrees, dedicated, errors)).ToList();
        var projectWorktrees = (projectFolders ?? [])
            .Select(entry => entry.Folder)
            .Where(folder => !SamePath(folder, worktrees))
            .SelectMany(folder => WorktreesOf(folder, IsLinkedWorktree));
        var listed = projects
            .Concat(WorktreesOf(worktrees, _ => true))
            .Concat(projectWorktrees)
            .DistinctBy(project => Path.TrimEndingDirectorySeparator(project.Path), StringComparer.OrdinalIgnoreCase)
            .ToList();
        return new ProjectListModel(root, listed, errors.Count == 0 ? null : string.Join(" ", errors), others);
    }

    private static IReadOnlyList<ProjectModel> ProjectsOf(string root, string worktrees, IReadOnlyList<string> dedicated, List<string> errors)
    {
        if (!Directory.Exists(root))
        {
            errors.Add($"Le dossier des projets est introuvable : {root}");
            return [];
        }

        try
        {
            return FoldersOf(root)
                .Where(directory => !string.Equals(directory.Name, ExcludedFolder, StringComparison.OrdinalIgnoreCase) && !SamePath(directory.FullName, worktrees) && !dedicated.Any(folder => SamePath(directory.FullName, folder)))
                .Select(directory => new ProjectModel(directory.Name, directory.FullName))
                .ToList();
        }
        catch (Exception exception) when (exception is UnauthorizedAccessException or IOException)
        {
            errors.Add($"Le dossier des projets est inaccessible : {exception.Message}");
            return [];
        }
    }

    private static IEnumerable<DirectoryInfo> FoldersOf(string path) =>
        new DirectoryInfo(path)
            .EnumerateDirectories()
            .Where(directory => !directory.Attributes.HasFlag(FileAttributes.Hidden))
            .OrderBy(directory => directory.Name, StringComparer.CurrentCultureIgnoreCase);

    private static bool SamePath(string first, string second) =>
        string.Equals(Path.TrimEndingDirectorySeparator(Path.GetFullPath(first)), Path.TrimEndingDirectorySeparator(Path.GetFullPath(second)), StringComparison.OrdinalIgnoreCase);

    private static bool IsLinkedWorktree(DirectoryInfo directory) => File.Exists(Path.Combine(directory.FullName, GitEntry));

    private static IReadOnlyList<ProjectModel> WorktreesOf(string folder, Func<DirectoryInfo, bool> accepted)
    {
        if (!Directory.Exists(folder))
        {
            return [];
        }

        try
        {
            return FoldersOf(folder).Where(accepted).Select(directory => new ProjectModel(directory.Name, directory.FullName, true)).ToList();
        }
        catch (Exception exception) when (exception is UnauthorizedAccessException or IOException)
        {
            return [];
        }
    }
}

using Tily.Core.Context;
using Tily.Core.Settings;
using Tily.Core.Updates;
using Tily.Core.Worktrees;

namespace Tily.Core.Appearance;

public sealed record AppearanceStateModel(AccentThemeModel Theme, string DefaultColor);

public sealed record FolderProjectModel(string Path, string? Project, string? Color)
{
    public string? ProjectName => Project is null ? null : System.IO.Path.GetFileName(Project);
}

public static class AccentResolver
{
    public static AppearanceStateModel Resolve(AppearanceSettingsModel appearance, ReleaseChannel channel)
    {
        var defaultColor = AccentPresets.DefaultFor(channel);
        var theme = AccentTheme.Build(HexColor.Normalize(appearance.Accent) ?? defaultColor);
        return new AppearanceStateModel(theme, defaultColor);
    }

    public static IReadOnlyList<FolderProjectModel> ProjectsOf(SettingsModel settings, IEnumerable<string> paths)
    {
        var worktreeFolder = settings.Worktrees.FolderFor(settings.ProjectsRoot);
        return paths
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Select(path =>
            {
                var project = ProjectOf(path, settings.ProjectsRoot, worktreeFolder);
                return new FolderProjectModel(path, project, ProjectColor(settings.Appearance, project));
            })
            .ToList();
    }

    public static string? ProjectOf(string? path, string projectsRoot, string worktreeFolder)
    {
        if (string.IsNullOrWhiteSpace(path) || !Path.IsPathFullyQualified(path) || !Path.IsPathFullyQualified(projectsRoot))
        {
            return null;
        }

        var repository = GitContext.MainRepositoryRoot(path);
        var folder = WorktreeLister.NormalizePath(repository ?? path);
        var inProjects = WorktreeTarget.IsWithin(folder, projectsRoot)
            && !WorktreeTarget.SamePath(folder, projectsRoot)
            && !WorktreeTarget.IsWithin(folder, worktreeFolder);
        if (inProjects)
        {
            return WorktreeSources.ProjectOf(folder, projectsRoot, worktreeFolder);
        }

        return repository is null ? null : folder;
    }

    public static string? ProjectColor(AppearanceSettingsModel settings, string? project) =>
        project is not null && settings.ProjectColors.TryGetValue(project, out var color) ? HexColor.Normalize(color) : null;
}

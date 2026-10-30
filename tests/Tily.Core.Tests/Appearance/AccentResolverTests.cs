using Tily.Core.Appearance;
using Tily.Core.Settings;
using Tily.Core.Updates;
using Xunit;

namespace Tily.Core.Tests.Appearance;

public sealed class AccentResolverTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "tily-accent-" + Guid.NewGuid().ToString("N"));

    private string Projects => Path.Combine(_root, "Projets à moi");

    private string Worktrees => Path.Combine(Projects, "worktrees");

    [Fact]
    public void Resolve_WhenNoAccent_ThenChannelDefault()
    {
        var state = AccentResolver.Resolve(AppearanceSettingsModel.Default, ReleaseChannel.Beta);

        Assert.Equal(AccentPresets.Blue, state.Theme.Accent);
    }

    [Fact]
    public void Resolve_WhenGlobalAccent_ThenThemeUsesIt()
    {
        var state = AccentResolver.Resolve(AppearanceSettingsModel.Default with { Accent = "#c98fa5" }, ReleaseChannel.Stable);

        Assert.Equal(("#c98fa5", AccentPresets.Sage), (state.Theme.Accent, state.DefaultColor));
    }

    [Fact]
    public void ProjectsOf_WhenProjectHasColor_ThenEachFolderGetsItOnce()
    {
        var first = Directory.CreateDirectory(Path.Combine(Projects, "tily", "web")).FullName;
        var second = Directory.CreateDirectory(Path.Combine(Projects, "tily", "src")).FullName;
        var settings = new SettingsModel { ProjectsRoot = Projects, Appearance = AppearanceSettingsModel.Default.WithProjectColor(Path.Combine(Projects, "TILY"), "#6fb3b0") };

        var projects = AccentResolver.ProjectsOf(settings, [first, second, first.ToUpperInvariant()]);

        Assert.Equal([new FolderProjectModel(first, Path.Combine(Projects, "tily"), "#6fb3b0"), new FolderProjectModel(second, Path.Combine(Projects, "tily"), "#6fb3b0")], projects);
    }

    [Fact]
    public void ProjectOf_WhenSubfolderOfProject_ThenFirstLevelFolder()
    {
        var nested = Directory.CreateDirectory(Path.Combine(Projects, "tily", "web", "src")).FullName;

        var project = AccentResolver.ProjectOf(nested, Projects, Worktrees);

        Assert.Equal(Path.Combine(Projects, "tily"), project);
    }

    [Fact]
    public void ProjectOf_WhenLinkedWorktree_ThenProjectOfMainRepository()
    {
        var main = Path.Combine(Projects, "tily", "app");
        var gitDirectory = Directory.CreateDirectory(Path.Combine(main, ".git", "worktrees", "feature")).FullName;
        var worktree = Directory.CreateDirectory(Path.Combine(Worktrees, "tily-feature")).FullName;
        File.WriteAllText(Path.Combine(worktree, ".git"), $"gitdir: {gitDirectory}\n");

        var project = AccentResolver.ProjectOf(worktree, Projects, Worktrees);

        Assert.Equal(Path.Combine(Projects, "tily"), project);
    }

    [Fact]
    public void ProjectOf_WhenOutsideProjectsWithoutRepository_ThenNull()
    {
        var folder = Directory.CreateDirectory(Path.Combine(_root, "ailleurs")).FullName;

        var project = AccentResolver.ProjectOf(folder, Projects, Worktrees);

        Assert.Null(project);
    }

    [Fact]
    public void ProjectOf_WhenOutsideProjectsInRepository_ThenRepositoryRoot()
    {
        var repository = Path.Combine(_root, "depot externe");
        Directory.CreateDirectory(Path.Combine(repository, ".git"));
        var nested = Directory.CreateDirectory(Path.Combine(repository, "src")).FullName;

        var project = AccentResolver.ProjectOf(nested, Projects, Worktrees);

        Assert.Equal(repository, project);
    }

    public void Dispose()
    {
        if (Directory.Exists(_root))
        {
            Directory.Delete(_root, true);
        }
    }
}

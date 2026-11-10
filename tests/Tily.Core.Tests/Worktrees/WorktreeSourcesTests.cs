using Tily.Core.Tests.Git;
using Tily.Core.Worktrees;
using Xunit;

namespace Tily.Core.Tests.Worktrees;

public sealed class WorktreeSourcesTests : IDisposable
{
    private readonly GitSandbox _sandbox = new();
    private readonly string _projectsRoot;
    private readonly string _worktrees;
    private readonly string _project;
    private readonly string _repository;

    public WorktreeSourcesTests()
    {
        _projectsRoot = Path.Combine(_sandbox.Root, "projets");
        _worktrees = Path.Combine(_projectsRoot, "worktrees");
        _project = Path.Combine(_projectsRoot, "App Starter Kit");
        _repository = Repository(Path.Combine(_project, "app-starter-kit"));
    }

    [Fact]
    public void Resolve_WhenProjectHasNestedRepository_ThenSelectsIt()
    {
        var sources = Resolve(_project, true);

        Assert.Equal(_repository, sources.Selected);
    }

    [Fact]
    public void Resolve_WhenRepositoryRemembered_ThenSelectsItBeforeDetectedOne()
    {
        var other = Repository(Path.Combine(_project, "autre"));

        var sources = Resolve(_project, true, other);

        Assert.Equal((other, other), (sources.Selected, sources.DefaultRepository));
    }

    [Fact]
    public void Resolve_WhenRememberedRepositoryMissing_ThenFallsBackToDetectedOne()
    {
        var sources = Resolve(_project, true, Path.Combine(_project, "disparu"));

        Assert.Equal(_repository, sources.DefaultRepository);
    }

    [Fact]
    public void Resolve_WhenStartedFromWorktree_ThenSelectsMainRepositoryOfItsProject()
    {
        var worktree = Path.Combine(_worktrees, "app-starter-kit-vue");
        _sandbox.GitIn(_repository, "worktree", "add", "-q", "-b", "vue", worktree);

        var sources = Resolve(worktree, false);

        Assert.Equal((WorktreeLister.NormalizePath(_project), _repository), (sources.Project, sources.Selected));
    }

    [Fact]
    public void Resolve_WhenStartedFromRepositoryOutsideRemembered_ThenKeepsRepositoryOfPath()
    {
        var other = Repository(Path.Combine(_project, "autre"));

        var sources = Resolve(_repository, false, other);

        Assert.Equal(_repository, sources.Selected);
    }

    [Fact]
    public void ProjectOf_WhenFolderDeepInProjectsRoot_ThenReturnsFirstLevelFolder()
    {
        var project = WorktreeSources.ProjectOf(Path.Combine(_project, "app-starter-kit", "src"), [_projectsRoot], _worktrees);

        Assert.Equal(WorktreeLister.NormalizePath(_project), project);
    }

    [Fact]
    public void ProjectOf_WhenFolderOutsideProjectsRoot_ThenReturnsFolderItself()
    {
        var outside = Path.Combine(_sandbox.Root, "ailleurs");

        var project = WorktreeSources.ProjectOf(outside, [_projectsRoot], _worktrees);

        Assert.Equal(WorktreeLister.NormalizePath(outside), project);
    }

    [Fact]
    public void ProjectOf_WhenFolderDeepInAdditionalRoot_ThenReturnsItsFirstLevelFolder()
    {
        var clients = Path.Combine(_sandbox.Root, "clients");

        var project = WorktreeSources.ProjectOf(Path.Combine(clients, "Client A", "api", "src"), [_projectsRoot, clients], _worktrees);

        Assert.Equal(WorktreeLister.NormalizePath(Path.Combine(clients, "Client A")), project);
    }

    [Fact]
    public void ProjectOf_WhenAdditionalRootInsideProjectsRoot_ThenDeepestRootWins()
    {
        var nested = Path.Combine(_projectsRoot, "Clients");

        var project = WorktreeSources.ProjectOf(Path.Combine(nested, "Client A", "src"), [_projectsRoot, nested], _worktrees);

        Assert.Equal(WorktreeLister.NormalizePath(Path.Combine(nested, "Client A")), project);
    }

    public void Dispose() => _sandbox.Dispose();

    private WorktreeSourcesModel Resolve(string path, bool fromProject, string? remembered = null) =>
        WorktreeSources.Resolve(_sandbox.Runner, path, fromProject, [_projectsRoot], _worktrees, _ => remembered);

    private string Repository(string folder)
    {
        Directory.CreateDirectory(folder);
        _sandbox.GitIn(folder, "init", "-q", "-b", "main");
        _sandbox.GitIn(folder, "commit", "-q", "--allow-empty", "-m", "Base");
        return WorktreeLister.NormalizePath(folder);
    }
}

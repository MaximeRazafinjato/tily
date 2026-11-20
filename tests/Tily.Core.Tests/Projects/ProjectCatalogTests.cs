using Tily.Core.Projects;
using Tily.Core.Worktrees;
using Xunit;

namespace Tily.Core.Tests.Projects;

public sealed class ProjectCatalogTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "tily-projects-" + Guid.NewGuid().ToString("N"));

    [Fact]
    public void List_WhenRootHasFolders_ThenReturnsFirstLevelSortedWithoutWorktrees()
    {
        Directory.CreateDirectory(Path.Combine(_root, "zeta"));
        Directory.CreateDirectory(Path.Combine(_root, "Alpha", "nested"));
        Directory.CreateDirectory(Path.Combine(_root, "worktrees"));
        File.WriteAllText(Path.Combine(_root, "fichier.txt"), string.Empty);

        var list = ProjectCatalog.List(_root);

        Assert.Null(list.Error);
        Assert.Equal(["Alpha", "zeta"], list.Projects.Select(project => project.Name));
        Assert.Equal(Path.Combine(_root, "Alpha"), list.Projects[0].Path);
    }

    [Fact]
    public void List_WhenWorktreesFolderHasFolders_ThenAppendsThemAsWorktreesAfterProjects()
    {
        Directory.CreateDirectory(Path.Combine(_root, "projet"));
        Directory.CreateDirectory(Path.Combine(_root, "worktrees", "projet-zeta"));
        Directory.CreateDirectory(Path.Combine(_root, "worktrees", "Projet-alpha"));
        File.WriteAllText(Path.Combine(_root, "worktrees", "notes.txt"), string.Empty);

        var list = ProjectCatalog.List(_root);

        Assert.Equal([("projet", false), ("Projet-alpha", true), ("projet-zeta", true)], list.Projects.Select(project => (project.Name, project.Worktree)));
    }

    [Fact]
    public void List_WhenWorktreeListed_ThenPathPointsIntoWorktreesFolder()
    {
        Directory.CreateDirectory(Path.Combine(_root, "worktrees", "projet-branche"));

        var list = ProjectCatalog.List(_root);

        Assert.Equal(Path.Combine(_root, "worktrees", "projet-branche"), Assert.Single(list.Projects).Path);
    }

    [Fact]
    public void List_WhenWorktreeFolderConfigured_ThenListsItAndHidesItFromProjects()
    {
        Directory.CreateDirectory(Path.Combine(_root, "projet"));
        Directory.CreateDirectory(Path.Combine(_root, "arbres", "projet-vue"));

        var list = ProjectCatalog.List(_root, Path.Combine(_root, "arbres"));

        Assert.Equal([("projet", false), ("projet-vue", true)], list.Projects.Select(project => (project.Name, project.Worktree)));
    }

    [Fact]
    public void List_WhenProjectFolderIsProjectItself_ThenKeepsProjectAndListsOnlyLinkedWorktrees()
    {
        var project = Path.Combine(_root, "ASK");
        Directory.CreateDirectory(Path.Combine(project, "app-starter-kit", ".git"));
        Directory.CreateDirectory(Path.Combine(project, "app-starter-kit-test"));
        File.WriteAllText(Path.Combine(project, "app-starter-kit-test", ".git"), "gitdir: ailleurs");

        var list = ProjectCatalog.List(_root, null, [new WorktreeProjectFolderModel(project, project)]);

        Assert.Equal([("ASK", false), ("app-starter-kit-test", true)], list.Projects.Select(entry => (entry.Name, entry.Worktree)));
    }

    [Fact]
    public void List_WhenProjectFolderDedicated_ThenHidesItFromProjectsAndListsItsWorktrees()
    {
        Directory.CreateDirectory(Path.Combine(_root, "projet"));
        Directory.CreateDirectory(Path.Combine(_root, "worktrees", "projet-vue"));
        Directory.CreateDirectory(Path.Combine(_root, "arbres", "projet-api"));
        File.WriteAllText(Path.Combine(_root, "arbres", "projet-api", ".git"), "gitdir: ailleurs");

        var list = ProjectCatalog.List(_root, null, [new WorktreeProjectFolderModel(Path.Combine(_root, "projet"), Path.Combine(_root, "arbres"))]);

        Assert.Equal([("projet", false), ("projet-vue", true), ("projet-api", true)], list.Projects.Select(entry => (entry.Name, entry.Worktree)));
    }

    [Fact]
    public void List_WhenAdditionalRoots_ThenAppendsTheirProjectsBeforeWorktrees()
    {
        var clients = Path.Combine(_root, "ailleurs", "Clients à part");
        Directory.CreateDirectory(Path.Combine(_root, "projets", "tily"));
        Directory.CreateDirectory(Path.Combine(_root, "projets", "worktrees", "tily-vue"));
        Directory.CreateDirectory(Path.Combine(clients, "zeta"));
        Directory.CreateDirectory(Path.Combine(clients, "Alpha"));
        Directory.CreateDirectory(Path.Combine(clients, "worktrees"));

        var list = ProjectCatalog.List(Path.Combine(_root, "projets"), null, null, [clients]);

        Assert.Null(list.Error);
        Assert.Equal([("tily", false), ("Alpha", false), ("zeta", false), ("tily-vue", true)], list.Projects.Select(project => (project.Name, project.Worktree)));
        Assert.Equal(Path.Combine(clients, "Alpha"), list.Projects[1].Path);
    }

    [Fact]
    public void List_WhenAdditionalRootMissing_ThenListsOtherRootsWithFrenchError()
    {
        var missing = Path.Combine(_root, "disparu");
        Directory.CreateDirectory(Path.Combine(_root, "projets", "tily"));

        var list = ProjectCatalog.List(Path.Combine(_root, "projets"), null, null, [missing]);

        Assert.Equal("tily", Assert.Single(list.Projects).Name);
        Assert.Equal($"Le dossier des projets est introuvable : {missing}", list.Error);
    }

    [Fact]
    public void List_WhenRootMissing_ThenReturnsEmptyWithFrenchError()
    {
        var list = ProjectCatalog.List(_root);

        Assert.Empty(list.Projects);
        Assert.Equal($"Le dossier des projets est introuvable : {_root}", list.Error);
    }

    public void Dispose()
    {
        if (Directory.Exists(_root))
        {
            Directory.Delete(_root, true);
        }
    }
}

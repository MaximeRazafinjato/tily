using Tily.Core.Clone;
using Tily.Core.Tests.Git;
using Xunit;

namespace Tily.Core.Tests.Clone;

public sealed class RepositoryClonerTests : IDisposable
{
    private readonly GitSandbox _sandbox = new();
    private readonly string _address;
    private readonly string _projects;
    private readonly List<string> _progress = [];

    public RepositoryClonerTests()
    {
        _sandbox.Commit("Base", ("a.txt", "a\n"), ("package.json", "{}\n"));
        _address = new Uri(_sandbox.CreateRemote()).AbsoluteUri;
        _sandbox.Git("push", "-q", "origin", "main");
        _projects = Path.Combine(_sandbox.Root, "Projets clonés");
    }

    [Fact]
    public void Clone_WhenAddressValid_ThenChecksOutRepositoryInProjectsFolder()
    {
        var result = RepositoryCloner.Clone(_sandbox.Runner, new CloneRequestModel(_address, null, null), _projects, _progress.Add);

        Assert.Equal((Path.Combine(_projects, "distant"), "a\n"), (result.Path, File.ReadAllText(Path.Combine(result.Path, "a.txt"))));
    }

    [Fact]
    public void Clone_WhenNameGiven_ThenClonesUnderThatName()
    {
        var result = RepositoryCloner.Clone(_sandbox.Runner, new CloneRequestModel(_address, null, "Mon dépôt"), _projects, _progress.Add);

        Assert.Equal("main", _sandbox.GitIn(result.Path, "symbolic-ref", "--short", "HEAD").Trim());
    }

    [Fact]
    public void Clone_WhenCloning_ThenReportsProgressInFrench()
    {
        RepositoryCloner.Clone(_sandbox.Runner, new CloneRequestModel(_address, null, null), _projects, _progress.Add);

        Assert.Equal("Clonage de « distant »…", _progress[0]);
    }

    [Fact]
    public void Clone_WhenRemoteMissing_ThenFailsInFrenchWithGitOutput()
    {
        var missing = new Uri(Path.Combine(_sandbox.Root, "absent.git")).AbsoluteUri;

        var failure = Assert.Throws<CloneException>(() => RepositoryCloner.Clone(_sandbox.Runner, new CloneRequestModel(missing, null, null), _projects, _progress.Add));

        Assert.Equal(("Le clonage de « absent » a échoué.", true), (failure.Message, failure.Output.Length > 0));
    }

    [Fact]
    public void Clone_WhenRemoteMissing_ThenLeavesNoFolder()
    {
        var missing = new Uri(Path.Combine(_sandbox.Root, "absent.git")).AbsoluteUri;

        Assert.Throws<CloneException>(() => RepositoryCloner.Clone(_sandbox.Runner, new CloneRequestModel(missing, null, null), _projects, _progress.Add));

        Assert.False(Directory.Exists(Path.Combine(_projects, "absent")));
    }

    [Fact]
    public void Clone_WhenTargetExists_ThenRefusesWithoutRunningGit()
    {
        Directory.CreateDirectory(Path.Combine(_projects, "distant"));

        var failure = Assert.Throws<CloneException>(() => RepositoryCloner.Clone(_sandbox.Runner, new CloneRequestModel(_address, null, null), _projects, _progress.Add));

        Assert.Equal(($"Le dossier existe déjà : {Path.Combine(_projects, "distant")}", 0), (failure.Message, _progress.Count));
    }

    public void Dispose() => _sandbox.Dispose();
}

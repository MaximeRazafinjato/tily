using Tily.Core.Forge;
using Tily.Core.Tests.Git;
using Xunit;

namespace Tily.Core.Tests.Forge;

public sealed class MergeRequestGitTests : IDisposable
{
    private readonly GitSandbox _sandbox = new();

    public MergeRequestGitTests()
    {
        _sandbox.CreateRemote();
        _sandbox.Commit("Base", ("a.txt", "a\n"));
        _sandbox.Git("push", "-q", "-u", "origin", "main");
        _sandbox.Git("checkout", "-q", "-b", "develop");
        _sandbox.Git("push", "-q", "-u", "origin", "develop");
        _sandbox.Git("remote", "set-head", "origin", "main");
        _sandbox.Git("checkout", "-q", "-b", "feat/création");
        _sandbox.Commit("✨ Créer des MR/PR", ("b.txt", "b\n"));
        _sandbox.Commit("🧪 Tester la création", ("c.txt", "c\n"));
    }

    private MergeRequestGit Git => new(_sandbox.Repository);

    [Fact]
    public void OriginBranches_WhenRemoteHeadSet_ThenListsBranchesWithoutHead()
    {
        var branches = (string.Join(',', Git.OriginBranches()), Git.OriginDefaultBranch(), string.Join(',', Git.LocalBranches()));

        Assert.Equal(("develop,main", "main", "develop,feat/création,main"), branches);
    }

    [Fact]
    public void Commits_WhenBranchAheadOfTarget_ThenListsCommitsOldestFirst()
    {
        var commits = Git.Commits("feat/création", "develop");

        Assert.Equal(["✨ Créer des MR/PR", "🧪 Tester la création"], commits.Select(commit => commit.Subject));
    }

    [Fact]
    public void Publication_WhenBranchUnpublished_ThenNeedsPush()
    {
        var publication = Git.Publication("feat/création");

        Assert.Equal((true, false, true), (publication.Local, publication.Published, publication.NeedsPush));
    }

    [Fact]
    public void Push_WhenBranchNotCurrent_ThenPublishesItWithUpstream()
    {
        _sandbox.Git("checkout", "-q", "main");

        Git.Push("feat/création");

        Assert.Equal((new BranchPublicationModel(true, true, 0), "origin"), (Git.Publication("feat/création"), _sandbox.Git("config", "branch.feat/création.remote").Trim()));
    }

    [Fact]
    public void Publication_WhenCommitsNotPushed_ThenCountsThem()
    {
        Git.Push("feat/création");
        _sandbox.Commit("Suite", ("d.txt", "d\n"));

        var publication = Git.Publication("feat/création");

        Assert.Equal((1, true), (publication.Ahead, publication.NeedsPush));
    }

    [Fact]
    public void Template_WhenGitHubTemplatePresent_ThenReadsIt()
    {
        _sandbox.Write(Path.Combine(".github", "pull_request_template.md"), "## Résumé\n");

        var template = (Git.Template(ForgeKind.GitHub), Git.Template(ForgeKind.GitLab));

        Assert.Equal(("## Résumé\n", null), template);
    }

    public void Dispose() => _sandbox.Dispose();
}

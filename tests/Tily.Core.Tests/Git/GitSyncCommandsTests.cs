using Tily.Core.Git;
using Xunit;

namespace Tily.Core.Tests.Git;

public sealed class GitSyncCommandsTests : IDisposable
{
    private readonly GitSandbox _sandbox = new();
    private readonly string _remote;

    public GitSyncCommandsTests()
    {
        _remote = _sandbox.CreateRemote();
        _sandbox.Commit("Base", ("a.txt", "a\n"));
    }

    private void PushFromOtherClone(string file)
    {
        var clone = _sandbox.Clone(_remote, $"autre-{file}");
        File.WriteAllText(Path.Combine(clone, file), "autre\n");
        _sandbox.GitIn(clone, "add", "-A");
        _sandbox.GitIn(clone, "commit", "-q", "-m", "Autre poste");
        _sandbox.GitIn(clone, "push", "-q");
    }

    [Fact]
    public void Push_WhenNoUpstream_ThenPublishesAndTracks()
    {
        var outcome = GitSyncCommands.Push(_sandbox.Repository, false, false, false);

        Assert.Equal("Branche « main » publiée sur origin.", outcome.Message);
        Assert.Equal("origin/main", _sandbox.Repository.Status().Head.Upstream);
    }

    [Fact]
    public void Push_WhenRemoteMovedAhead_ThenRejectedWithoutForcing()
    {
        GitSyncCommands.Push(_sandbox.Repository, false, false, false);
        PushFromOtherClone("b.txt");
        _sandbox.Commit("Local", ("c.txt", "c\n"));

        var exception = Assert.Throws<GitPushRejectedException>(() => GitSyncCommands.Push(_sandbox.Repository, false, false, false));

        Assert.Equal("main", exception.Branch);
        Assert.StartsWith("Push refusé : la branche distante contient des commits absents", exception.Message);
    }

    [Fact]
    public void ForcePush_WhenNotAllowedYet_ThenRefuses()
    {
        GitSyncCommands.Push(_sandbox.Repository, false, false, false);

        var exception = Assert.Throws<GitCommandException>(() => GitSyncCommands.Push(_sandbox.Repository, true, true, false));

        Assert.Equal("Le push forcé n’est proposé qu’après un push refusé.", exception.Message);
    }

    [Fact]
    public void ForcePush_WhenHistoryRewritten_ThenLeaseAllowsOverwrite()
    {
        GitSyncCommands.Push(_sandbox.Repository, false, false, false);
        _sandbox.Commit("À réécrire", ("b.txt", "b\n"));
        GitSyncCommands.Push(_sandbox.Repository, false, false, false);
        _sandbox.Write("b.txt", "réécrit\n");
        GitChangeCommands.Stage(_sandbox.Repository, []);
        GitChangeCommands.Commit(_sandbox.Repository, "Réécrit", true);
        Assert.Throws<GitPushRejectedException>(() => GitSyncCommands.Push(_sandbox.Repository, false, false, false));

        var outcome = GitSyncCommands.Push(_sandbox.Repository, true, true, true);

        Assert.Equal("Push forcé vers origin/main (--force-with-lease).", outcome.Message);
        Assert.Equal(_sandbox.Head(), _sandbox.GitIn(_remote, "rev-parse", "main").Trim());
    }

    [Fact]
    public void ForcePush_WhenRemoteChangedSinceFetch_ThenLeaseRefuses()
    {
        GitSyncCommands.Push(_sandbox.Repository, false, false, false);
        PushFromOtherClone("b.txt");
        _sandbox.Commit("Local", ("c.txt", "c\n"));

        var exception = Assert.Throws<GitCommandException>(() => GitSyncCommands.Push(_sandbox.Repository, true, true, true));

        Assert.StartsWith("Push forcé refusé", exception.Message);
    }

    [Fact]
    public void PushUpTo_WhenBranchNotCurrent_ThenPublishesItWithoutCheckout()
    {
        _sandbox.Git("switch", "-q", "-c", "fonction");
        var tip = _sandbox.Commit("Fonction", ("f.txt", "f\n"));
        _sandbox.Git("switch", "-q", "main");

        var outcome = GitSyncCommands.PushUpTo(_sandbox.Repository, "fonction", null);

        Assert.Equal(("Branche « fonction » publiée sur origin.", tip, "main"), (outcome.Message, _sandbox.GitIn(_remote, "rev-parse", "fonction").Trim(), _sandbox.Branch()));
    }

    [Fact]
    public void PushUpTo_WhenCommitBeforeTip_ThenPushesOnlyUpToIt()
    {
        GitSyncCommands.Push(_sandbox.Repository, false, false, false);
        var first = _sandbox.Commit("Premier", ("b.txt", "b\n"));
        _sandbox.Commit("Second", ("c.txt", "c\n"));

        var outcome = GitSyncCommands.PushUpTo(_sandbox.Repository, "main", first);

        Assert.Equal(($"Push vers origin/main jusqu’à {first[..7]} terminé.", first), (outcome.Message, _sandbox.GitIn(_remote, "rev-parse", "main").Trim()));
    }

    [Fact]
    public void PushUpTo_WhenUnpublishedBranchUpToCommit_ThenPublishesAndTracks()
    {
        _sandbox.Git("switch", "-q", "-c", "fonction");
        var first = _sandbox.Commit("Premier", ("b.txt", "b\n"));
        _sandbox.Commit("Second", ("c.txt", "c\n"));

        var outcome = GitSyncCommands.PushUpTo(_sandbox.Repository, "fonction", first);

        Assert.Equal(($"Branche « fonction » publiée sur origin jusqu’à {first[..7]}.", "origin/fonction", 1), (outcome.Message, _sandbox.Repository.Status().Head.Upstream, _sandbox.Repository.Status().Head.Ahead));
    }

    [Fact]
    public void PushUpTo_WhenCommitNotOnBranch_ThenRefuses()
    {
        _sandbox.Git("switch", "-q", "-c", "fonction");
        var other = _sandbox.Commit("Ailleurs", ("b.txt", "b\n"));
        _sandbox.Git("switch", "-q", "main");

        var exception = Assert.Throws<GitCommandException>(() => GitSyncCommands.PushUpTo(_sandbox.Repository, "main", other));

        Assert.Equal($"Le commit {other[..7]} n’est pas sur la branche « main ».", exception.Message);
    }

    [Fact]
    public void PushUpTo_WhenRemoteMovedAheadOfOtherBranch_ThenRefusedWithoutOfferingForce()
    {
        GitSyncCommands.Push(_sandbox.Repository, false, false, false);
        PushFromOtherClone("b.txt");
        _sandbox.Commit("Local", ("c.txt", "c\n"));
        _sandbox.Git("switch", "-q", "-c", "autre");

        var exception = Assert.Throws<GitCommandException>(() => GitSyncCommands.PushUpTo(_sandbox.Repository, "main", null));

        Assert.Equal("Push refusé : la branche distante contient des commits absents de « main ». Faites un checkout de « main » puis un pull pour les intégrer.", exception.Message);
    }

    [Fact]
    public void Pull_WhenBranchesDiverged_ThenMergesAndUndoRestores()
    {
        GitSyncCommands.Push(_sandbox.Repository, false, false, false);
        PushFromOtherClone("b.txt");
        var local = _sandbox.Commit("Local", ("c.txt", "c\n"));

        var outcome = GitSyncCommands.Pull(_sandbox.Repository);
        var pulled = _sandbox.Exists("b.txt");
        GitUndo.Apply(_sandbox.Repository, outcome.Undo);

        Assert.True(pulled);
        Assert.Equal(local, _sandbox.Head());
        Assert.False(_sandbox.Exists("b.txt"));
    }

    [Fact]
    public void DeleteRemoteBranch_WhenConfirmed_ThenRemovesItFromRemote()
    {
        GitSyncCommands.Push(_sandbox.Repository, false, false, false);
        _sandbox.Git("push", "-q", "origin", "main:jetable");
        _sandbox.Git("fetch", "-q");

        var outcome = GitSyncCommands.DeleteRemoteBranch(_sandbox.Repository, "origin/jetable", true);

        Assert.True(outcome.ClearUndo);
        Assert.False(_sandbox.Runner.Run(_remote, ["rev-parse", "--verify", "-q", "refs/heads/jetable"]).Succeeded);
    }

    public void Dispose() => _sandbox.Dispose();
}

using Tily.Core.Git;
using Xunit;

namespace Tily.Core.Tests.Git;

public sealed class GitConflictCommandsTests : IDisposable
{
    private readonly GitSandbox _sandbox = new();

    [Fact]
    public void Read_WhenMergeConflict_ThenGivesChunksAndBranchNames()
    {
        CreateConflict("a\nb\nc\nd\n", "A\nb\nc\nours\n", "a\nb\nc\ntheirs\n");

        var file = GitConflictReader.Read(_sandbox.Repository, "f.txt");

        Assert.Equal(GitConflictView.Text, file.View);
        Assert.Equal(new GitConflictSidesModel("main", "feature"), file.Sides);
        Assert.Equal([GitMergeChunkKind.Ours, GitMergeChunkKind.Common, GitMergeChunkKind.Conflict], file.Chunks.Select(chunk => chunk.Kind));
        Assert.Equal(["ours"], file.Chunks[2].Ours);
        Assert.Equal(["theirs"], file.Chunks[2].Theirs);
        Assert.True(file.FinalNewline);
    }

    [Fact]
    public void Read_WhenRebaseConflict_ThenOursIsTheUpstreamAndTheirsTheRebasedBranch()
    {
        _sandbox.Commit("Base", ("f.txt", "a\n"));
        _sandbox.Git("checkout", "-q", "-b", "feature");
        _sandbox.Commit("Feature", ("f.txt", "theirs\n"));
        _sandbox.Git("checkout", "-q", "main");
        _sandbox.Commit("Main", ("f.txt", "ours\n"));
        _sandbox.Git("checkout", "-q", "feature");
        _sandbox.Repository.Run("rebase", "main");

        var sides = GitConflictReader.Read(_sandbox.Repository, "f.txt").Sides;

        Assert.Equal(new GitConflictSidesModel("main", "feature"), sides);
    }

    [Fact]
    public void Write_WhenResultSaved_ThenKeepsCrlfAndMarksResolved()
    {
        CreateConflict("a\r\nb\r\n", "a\r\nours\r\n", "a\r\ntheirs\r\n");
        var version = GitConflictReader.Read(_sandbox.Repository, "f.txt").Version;

        GitConflictCommands.Write(_sandbox.Repository, "f.txt", "a\nrésultat\n", version, false);

        Assert.Equal("a\r\nrésultat\r\n", _sandbox.Read("f.txt"));
        Assert.Empty(_sandbox.Repository.Status().Conflicts);
    }

    [Fact]
    public void Write_WhenFileChangedSinceOpening_ThenRefusesWithCode()
    {
        CreateConflict("a\n", "ours\n", "theirs\n");
        var version = GitConflictReader.Read(_sandbox.Repository, "f.txt").Version;
        _sandbox.Write("f.txt", "édité ailleurs\n");

        var exception = Assert.Throws<GitCommandException>(() => GitConflictCommands.Write(_sandbox.Repository, "f.txt", "résultat\n", version, false));

        Assert.Equal(GitFailureCode.FileChanged, exception.Code);
        Assert.Equal("édité ailleurs\n", _sandbox.Read("f.txt"));
    }

    [Fact]
    public void Write_WhenResultHasMarkers_ThenRefusesUnlessConfirmed()
    {
        CreateConflict("a\n", "ours\n", "theirs\n");
        var version = GitConflictReader.Read(_sandbox.Repository, "f.txt").Version;

        var exception = Assert.Throws<GitCommandException>(() => GitConflictCommands.Write(_sandbox.Repository, "f.txt", "<<<<<<< HEAD\n", version, false));

        Assert.Equal(GitFailureCode.ConflictMarkers, exception.Code);
    }

    [Theory]
    [InlineData("ours", "ours\n")]
    [InlineData("theirs", "theirs\n")]
    public void Take_WhenSideChosen_ThenWritesThatVersionAndMarksResolved(string mode, string expected)
    {
        CreateConflict("a\n", "ours\n", "theirs\n");

        GitConflictCommands.Take(_sandbox.Repository, "f.txt", mode, true);

        Assert.Equal(expected, _sandbox.Read("f.txt"));
        Assert.Empty(_sandbox.Repository.Status().Conflicts);
    }

    [Fact]
    public void Take_WhenDeletedByThemAndDeletionChosen_ThenRemovesFile()
    {
        _sandbox.Commit("Base", ("f.txt", "a\n"));
        _sandbox.Git("checkout", "-q", "-b", "feature");
        _sandbox.Git("rm", "-q", "f.txt");
        _sandbox.Git("commit", "-q", "-m", "Suppression");
        _sandbox.Git("checkout", "-q", "main");
        _sandbox.Commit("Main", ("f.txt", "ours\n"));
        _sandbox.Repository.Run("merge", "feature");
        var file = GitConflictReader.Read(_sandbox.Repository, "f.txt");

        GitConflictCommands.Take(_sandbox.Repository, "f.txt", "delete", true);

        Assert.Equal((GitConflictView.Presence, GitConflictKind.DeletedByThem, true, false), (file.View, file.Kind, file.OursExists, file.TheirsExists));
        Assert.False(_sandbox.Exists("f.txt"));
        Assert.Empty(_sandbox.Repository.Status().Conflicts);
    }

    [Fact]
    public void Take_WhenNotConfirmed_ThenRefuses()
    {
        CreateConflict("a\n", "ours\n", "theirs\n");

        Assert.Throws<GitCommandException>(() => GitConflictCommands.Take(_sandbox.Repository, "f.txt", "ours", false));
    }

    [Fact]
    public void Read_WhenFileNoLongerConflicted_ThenRefusesInFrench()
    {
        _sandbox.Commit("Base", ("f.txt", "a\n"));

        var exception = Assert.Throws<GitCommandException>(() => GitConflictReader.Read(_sandbox.Repository, "f.txt"));

        Assert.Equal("« f.txt » n’est plus en conflit.", exception.Message);
    }

    private void CreateConflict(string baseContent, string ours, string theirs)
    {
        _sandbox.Commit("Base", ("f.txt", baseContent));
        _sandbox.Git("checkout", "-q", "-b", "feature");
        _sandbox.Commit("Feature", ("f.txt", theirs));
        _sandbox.Git("checkout", "-q", "main");
        _sandbox.Commit("Main", ("f.txt", ours));
        _sandbox.Repository.Run("merge", "feature");
    }

    public void Dispose() => _sandbox.Dispose();
}

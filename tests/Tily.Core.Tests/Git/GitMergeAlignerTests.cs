using Tily.Core.Git;
using Xunit;

namespace Tily.Core.Tests.Git;

public sealed class GitMergeAlignerTests
{
    [Fact]
    public void ParseHunks_WhenInsertionDeletionAndChange_ThenGivesZeroBasedRanges()
    {
        const string diff = "diff --git a/x b/x\n@@ -0,0 +1,2 @@\n+a\n+b\n@@ -4 +6,0 @@\n-c\n@@ -8,2 +9 @@\n-d\n-e\n+f\n";

        var hunks = GitMergeAligner.ParseHunks(diff);

        Assert.Equal([new GitLineHunkModel(0, 0, 0, 2), new GitLineHunkModel(3, 4, 6, 6), new GitLineHunkModel(7, 9, 8, 9)], hunks);
    }

    [Fact]
    public void Merge_WhenChangesOnSeparateLines_ThenKeepsBothWithoutConflict()
    {
        string[] baseLines = ["a", "b", "c", "d", "e"];
        string[] ours = ["A", "b", "c", "d", "e"];
        string[] theirs = ["a", "b", "c", "d", "E"];

        var chunks = GitMergeAligner.Merge(baseLines, ours, theirs, [new GitLineHunkModel(0, 1, 0, 1)], [new GitLineHunkModel(4, 5, 4, 5)]);

        Assert.Equal([GitMergeChunkKind.Ours, GitMergeChunkKind.Common, GitMergeChunkKind.Theirs], chunks.Select(chunk => chunk.Kind));
        Assert.Equal(["A", "b", "c", "d", "E"], chunks.SelectMany(chunk => chunk.Result!));
    }

    [Fact]
    public void Merge_WhenSameLineChangedDifferently_ThenIsolatesConflictAndTrimsCommonLines()
    {
        string[] baseLines = ["a", "b", "c"];
        string[] ours = ["a", "x", "B1", "y", "c"];
        string[] theirs = ["a", "x", "B2", "y", "c"];

        var chunks = GitMergeAligner.Merge(baseLines, ours, theirs, [new GitLineHunkModel(1, 2, 1, 4)], [new GitLineHunkModel(1, 2, 1, 4)]);

        Assert.Equal([GitMergeChunkKind.Common, GitMergeChunkKind.Both, GitMergeChunkKind.Conflict, GitMergeChunkKind.Both, GitMergeChunkKind.Common], chunks.Select(chunk => chunk.Kind));
        var conflict = chunks[2];
        Assert.Equal(["B1"], conflict.Ours);
        Assert.Equal(["B2"], conflict.Theirs);
        Assert.Null(conflict.Result);
    }

    [Fact]
    public void Merge_WhenAdjacentLinesChangedOnEachSide_ThenReportsConflictLikeGit()
    {
        string[] baseLines = ["a", "b", "c"];
        string[] ours = ["a", "B", "c"];
        string[] theirs = ["a", "b", "C"];

        var chunks = GitMergeAligner.Merge(baseLines, ours, theirs, [new GitLineHunkModel(1, 2, 1, 2)], [new GitLineHunkModel(2, 3, 2, 3)]);

        Assert.Equal([GitMergeChunkKind.Common, GitMergeChunkKind.Conflict], chunks.Select(chunk => chunk.Kind));
        Assert.Equal(["B", "c"], chunks[1].Ours);
        Assert.Equal(["b", "C"], chunks[1].Theirs);
    }

    [Fact]
    public void Merge_WhenSameChangeOnBothSides_ThenMergesWithoutConflict()
    {
        string[] baseLines = ["a", "b"];
        string[] changed = ["a", "z"];

        var chunks = GitMergeAligner.Merge(baseLines, changed, changed, [new GitLineHunkModel(1, 2, 1, 2)], [new GitLineHunkModel(1, 2, 1, 2)]);

        Assert.DoesNotContain(chunks, chunk => chunk.Kind == GitMergeChunkKind.Conflict);
        Assert.Equal(["a", "z"], chunks.SelectMany(chunk => chunk.Result!));
    }

    [Fact]
    public void Merge_WhenLinesInsertedAtSamePlace_ThenConflictKeepsLaterLinesAligned()
    {
        string[] baseLines = ["a", "b"];
        string[] ours = ["a", "o1", "o2", "b"];
        string[] theirs = ["a", "t", "b", "c"];

        var chunks = GitMergeAligner.Merge(baseLines, ours, theirs, [new GitLineHunkModel(1, 1, 1, 3)], [new GitLineHunkModel(1, 1, 1, 2), new GitLineHunkModel(2, 2, 3, 4)]);

        Assert.Equal([GitMergeChunkKind.Common, GitMergeChunkKind.Conflict, GitMergeChunkKind.Common, GitMergeChunkKind.Theirs], chunks.Select(chunk => chunk.Kind));
        Assert.Equal(["o1", "o2"], chunks[1].Ours);
        Assert.Equal(["t"], chunks[1].Theirs);
        Assert.Equal(["c"], chunks[3].Result);
    }
}

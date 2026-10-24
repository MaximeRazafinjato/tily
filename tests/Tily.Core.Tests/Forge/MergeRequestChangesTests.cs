using Tily.Core.Forge;
using Xunit;

namespace Tily.Core.Tests.Forge;

public sealed class MergeRequestChangesTests
{
    private static readonly MergeRequestInputModel Original = new("feat/modification", "develop", "Modifier des MR/PR", "Résumé", ["bob", "carol"], "alice", ["git", "enhancement"], false);

    [Fact]
    public void Between_WhenNothingChangedButOrder_ThenNoChange()
    {
        var changes = MergeRequestChanges.Between(157, Original, Original with { Labels = ["enhancement", "git"], Description = "Résumé\r\n" }, false);

        Assert.False(changes.Any);
    }

    [Fact]
    public void Between_WhenReviewersSwapped_ThenListsAddedAndRemoved()
    {
        var changes = MergeRequestChanges.Between(157, Original, Original with { Reviewers = ["carol", "dave"] }, false);

        Assert.Equal(("dave", "bob", true, false), (string.Join(',', changes.AddedReviewers), string.Join(',', changes.RemovedReviewers), changes.ReviewersChanged, changes.TitleChanged));
    }

    [Fact]
    public void Between_WhenOnlyClosing_ThenHasChange()
    {
        var changes = MergeRequestChanges.Between(157, Original, Original, true);

        Assert.True(changes.Any);
    }

    [Fact]
    public void Between_WhenSourceChanged_ThenRefuses()
    {
        var exception = Assert.Throws<ForgeException>(() => MergeRequestChanges.Between(157, Original, Original with { SourceBranch = "feat/autre" }, false));

        Assert.Equal("La branche source d’une MR/PR existante ne se modifie pas.", exception.Message);
    }

    [Fact]
    public void Between_WhenNumberMissing_ThenRefuses()
    {
        var exception = Assert.Throws<ForgeException>(() => MergeRequestChanges.Between(0, Original, Original, false));

        Assert.Equal("Numéro de MR/PR manquant.", exception.Message);
    }
}

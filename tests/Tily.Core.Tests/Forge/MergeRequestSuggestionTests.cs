using Tily.Core.Forge;
using Xunit;

namespace Tily.Core.Tests.Forge;

public sealed class MergeRequestSuggestionTests
{
    private static readonly MergeRequestCommitModel First = new("✨ Créer des MR/PR", "Formulaire complet.\r\nAvec reviewers.");
    private static readonly MergeRequestCommitModel Second = new("🧪 Tester la création", string.Empty);

    [Fact]
    public void Title_WhenSingleCommit_ThenUsesItsSubject()
    {
        var title = MergeRequestSuggestion.Title("feat/156-creer-mr-pr", [First]);

        Assert.Equal("✨ Créer des MR/PR", title);
    }

    [Fact]
    public void Title_WhenSeveralCommits_ThenHumanizesBranchName()
    {
        var title = MergeRequestSuggestion.Title("feat/156-creer_mr-pr", [First, Second]);

        Assert.Equal("156 creer mr pr", title);
    }

    [Fact]
    public void Title_WhenNoCommit_ThenCapitalizesBranchName()
    {
        var title = MergeRequestSuggestion.Title("feat/creer-mr", []);

        Assert.Equal("Creer mr", title);
    }

    [Fact]
    public void Description_WhenSingleCommit_ThenUsesItsBody()
    {
        var description = MergeRequestSuggestion.Description([First], null);

        Assert.Equal("Formulaire complet.\r\nAvec reviewers.", description);
    }

    [Fact]
    public void Description_WhenSeveralCommits_ThenListsTheirSubjects()
    {
        var description = MergeRequestSuggestion.Description([First, Second], null);

        Assert.Equal("- ✨ Créer des MR/PR\n- 🧪 Tester la création", description);
    }

    [Fact]
    public void Description_WhenTemplateExists_ThenTemplateWins()
    {
        var description = MergeRequestSuggestion.Description([First, Second], "## Résumé\r\n\r\n## Tests\r\n");

        Assert.Equal("## Résumé\n\n## Tests", description);
    }
}

using Tily.Core.Updates;
using Xunit;

namespace Tily.Core.Tests.Updates;

public sealed class ReleaseNotesTests
{
    [Fact]
    public void Highlights_WhenNouveautesSection_ThenKeepsOnlyItsItems()
    {
        var body = "Intro.\n\n## Installation\n1. Lancer.\n\n## Nouveautés\n- Premier point.\n* Second point.\n### Détail\nSous-section gardée.\n## Suite\n- Ignoré.";

        var notes = ReleaseNotes.Highlights(body);

        Assert.Equal(["Premier point.", "Second point.", "Sous-section gardée."], notes.Select(note => note.Text));
    }

    [Fact]
    public void Highlights_WhenNoNouveautesSection_ThenKeepsWholeBodyWithoutHeadings()
    {
        var body = "## What's Changed\n- Fix #12\n\n**Full Changelog**: v1.2.0...v1.3.0";

        var notes = ReleaseNotes.Highlights(body);

        Assert.Equal(["Fix #12", "**Full Changelog**: v1.2.0...v1.3.0"], notes.Select(note => note.Text));
    }

    [Fact]
    public void Highlights_WhenBodyMissing_ThenReturnsNothing()
    {
        var notes = ReleaseNotes.Highlights(null);

        Assert.Empty(notes);
    }

    [Fact]
    public void Highlights_WhenNoteHasTitleSeparator_ThenSplitsTitleAndText()
    {
        var body = "## Nouveautés\n- Ambiance visuelle — Fond animé et terminaux translucides.";

        var notes = ReleaseNotes.Highlights(body);

        Assert.Equal([new ReleaseNoteModel("Ambiance visuelle", "Fond animé et terminaux translucides.")], notes);
    }

    [Fact]
    public void Highlights_WhenNoteHasNoSeparator_ThenKeepsTextWithoutTitle()
    {
        var body = "## Nouveautés\n- Coloration syntaxique dans le diff Git (#203).";

        var notes = ReleaseNotes.Highlights(body);

        Assert.Equal([new ReleaseNoteModel(null, "Coloration syntaxique dans le diff Git (#203).")], notes);
    }

    [Fact]
    public void Highlights_WhenTextBeforeSeparatorTooLong_ThenKeepsWholeLineAsText()
    {
        var line = $"{new string('a', 61)} — suite.";

        var notes = ReleaseNotes.Highlights($"## Nouveautés\n- {line}");

        Assert.Equal([new ReleaseNoteModel(null, line)], notes);
    }

    [Fact]
    public void Highlights_WhenNothingAfterSeparator_ThenKeepsWholeLineAsText()
    {
        var notes = ReleaseNotes.Highlights("## Nouveautés\n- Titre seul —");

        Assert.Equal([new ReleaseNoteModel(null, "Titre seul —")], notes);
    }
}

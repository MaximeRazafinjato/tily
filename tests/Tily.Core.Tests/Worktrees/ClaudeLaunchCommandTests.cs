using Tily.Core.Worktrees;
using Xunit;

namespace Tily.Core.Tests.Worktrees;

public sealed class ClaudeLaunchCommandTests
{
    [Fact]
    public void For_WhenNotRequested_ThenNull()
    {
        var command = ClaudeLaunchCommand.For(false, "Corrige le bug");

        Assert.Null(command);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" \r\n\t ")]
    public void For_WhenPromptBlank_ThenClaudeAlone(string? prompt)
    {
        var command = ClaudeLaunchCommand.For(true, prompt);

        Assert.Equal("claude", command);
    }

    [Fact]
    public void For_WhenPromptOnSeveralLines_ThenFlattensWhitespace()
    {
        var command = ClaudeLaunchCommand.For(true, "  Corrige le bug\r\n\r\n\tpuis   lance les tests  ");

        Assert.Equal("claude 'Corrige le bug puis lance les tests'", command);
    }

    [Fact]
    public void For_WhenPromptHasQuotes_ThenEscapesForPowerShellAndNativeArguments()
    {
        var command = ClaudeLaunchCommand.For(true, "Dis \"bonjour\" à l'API ‘x’");

        Assert.Equal("claude 'Dis \\\"bonjour\\\" à l''API ‘‘x’’'", command);
    }

    [Theory]
    [InlineData(@"Lis C:\temp\", @"claude 'Lis C:\temp\\'")]
    [InlineData(@"Garde a\""b tel quel", @"claude 'Garde a\\\""b tel quel'")]
    [InlineData(@"C:\temp\", @"claude 'C:\temp\'")]
    public void For_WhenPromptHasBackslashes_ThenDoublesOnlyThoseBeforeAQuote(string prompt, string expected)
    {
        var command = ClaudeLaunchCommand.For(true, prompt);

        Assert.Equal(expected, command);
    }

    [Fact]
    public void For_WhenPromptStartsWithDash_ThenEndsOptionsFirst()
    {
        var command = ClaudeLaunchCommand.For(true, "--help explique-moi");

        Assert.Equal("claude -- '--help explique-moi'", command);
    }

    [Fact]
    public void For_WhenPromptIsSlashCommand_ThenPassedAsIs()
    {
        var command = ClaudeLaunchCommand.For(true, "/usage");

        Assert.Equal("claude '/usage'", command);
    }

    [Fact]
    public void For_WhenPromptTooLong_ThenFailsInFrench()
    {
        var prompt = new string('a', ClaudeLaunchCommand.PromptMaxLength + 1);

        var failure = Assert.Throws<WorktreeException>(() => ClaudeLaunchCommand.For(true, prompt));

        Assert.Equal($"Le texte pour Claude Code dépasse {ClaudeLaunchCommand.PromptMaxLength} caractères.", failure.Message);
    }
}

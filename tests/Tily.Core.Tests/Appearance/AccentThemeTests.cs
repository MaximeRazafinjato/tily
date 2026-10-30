using Tily.Core.Appearance;
using Xunit;

namespace Tily.Core.Tests.Appearance;

public sealed class AccentThemeTests
{
    private const int Tolerance = 6;

    public static TheoryData<string, string, string> HandTunedTokens => new()
    {
        { AccentPresets.Sage, "paper", "#17191b" },
        { AccentPresets.Sage, "panel", "#1e2123" },
        { AccentPresets.Sage, "line", "#2c3033" },
        { AccentPresets.Sage, "ink", "#d8dbd7" },
        { AccentPresets.Sage, "muted", "#848b87" },
        { AccentPresets.Sage, "green-deep", "#a9c4b4" },
        { AccentPresets.Sage, "green-soft", "#262d2a" },
        { AccentPresets.Sage, "focus", "#8fb39f" },
        { AccentPresets.Sage, "terminal", "#121416" },
        { AccentPresets.Blue, "paper", "#14181e" },
        { AccentPresets.Blue, "panel", "#1b1f26" },
        { AccentPresets.Blue, "ink", "#d4d8de" },
        { AccentPresets.Blue, "green-deep", "#a6c4ec" },
        { AccentPresets.Blue, "green-soft", "#222a37" },
        { AccentPresets.Blue, "focus", "#88ade0" },
        { AccentPresets.Blue, "terminal", "#101318" }
    };

    [Theory]
    [MemberData(nameof(HandTunedTokens))]
    public void Build_WhenChannelDefault_ThenStaysCloseToHandTunedPalette(string accent, string token, string expected)
    {
        var theme = AccentTheme.Build(accent);

        Assert.True(Distance(theme.Tokens[token], expected) <= Tolerance, $"{token} : {theme.Tokens[token]} au lieu de {expected}");
    }

    [Fact]
    public void Build_WhenAccentInRange_ThenAccentTokenIsTheChosenColor()
    {
        var theme = AccentTheme.Build("#C98FA5");

        Assert.Equal("#c98fa5", theme.Tokens[AccentTheme.AccentToken]);
    }

    [Fact]
    public void Build_WhenAccentTooDark_ThenAccentLightnessRaised()
    {
        var theme = AccentTheme.Build("#101060");

        Assert.InRange(OklchColor.FromHex(theme.Accent).Lightness, 0.54, 0.81);
    }

    [Fact]
    public void Build_ThenTerminalUsesTintedTokens()
    {
        var theme = AccentTheme.Build(AccentPresets.Sage);

        Assert.Equal(new TerminalThemeModel(theme.Tokens["terminal"], theme.Tokens["terminal-ink"], theme.Tokens["focus"], "#7a9f8b40"), theme.Terminal);
    }

    [Fact]
    public void Build_ThenWindowFollowsPaperAndInk()
    {
        var theme = AccentTheme.Build(AccentPresets.Blue);

        Assert.Equal(new WindowColorsModel(theme.Tokens["paper"], theme.Tokens["ink"], theme.Tokens["muted"], theme.Tokens["green-hover"]), theme.Window);
    }

    private static int Distance(string first, string second)
    {
        var (red, green, blue) = HexColor.Channels(first);
        var (otherRed, otherGreen, otherBlue) = HexColor.Channels(second);
        return new[] { Math.Abs(red - otherRed), Math.Abs(green - otherGreen), Math.Abs(blue - otherBlue) }.Max();
    }
}

using Tily.Core.Shortcuts;
using Xunit;

namespace Tily.Core.Tests.Shortcuts;

public sealed class ShortcutChordTests
{
    [Theory]
    [InlineData("shift+ctrl+d", "Ctrl+Shift+D")]
    [InlineData(" Alt + arrowleft ", "Alt+ArrowLeft")]
    [InlineData("Control+Maj+pageup", "Ctrl+Shift+PageUp")]
    [InlineData("Ctrl+Shift+1", "Ctrl+1")]
    [InlineData("Ctrl+Plus", "Ctrl+Plus")]
    [InlineData("f12", "F12")]
    [InlineData("Ctrl+Space", "Ctrl+Space")]
    public void Normalize_WhenChordValid_ThenReturnsCanonicalForm(string text, string expected)
    {
        var chord = ShortcutChord.Normalize(text);

        Assert.Equal(expected, chord);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Ctrl+")]
    [InlineData("Ctrl+Shift")]
    [InlineData("Hyper+D")]
    [InlineData("F25")]
    [InlineData("F05")]
    [InlineData("Ctrl+Fleche")]
    public void Normalize_WhenChordInvalid_ThenReturnsNull(string? text)
    {
        var chord = ShortcutChord.Normalize(text);

        Assert.Null(chord);
    }

    [Theory]
    [InlineData("t", "T")]
    [InlineData("Shift+T", "T")]
    [InlineData("Shift+ArrowLeft", "Shift+ArrowLeft")]
    [InlineData("Shift+!", "!")]
    public void NormalizeLeaderKey_WhenKeyValid_ThenDropsShiftForCharacters(string text, string expected)
    {
        var key = ShortcutChord.NormalizeLeaderKey(text);

        Assert.Equal(expected, key);
    }

    [Fact]
    public void NormalizeLeaderKey_WhenCtrlPressed_ThenReturnsNull()
    {
        var key = ShortcutChord.NormalizeLeaderKey("Ctrl+T");

        Assert.Null(key);
    }

    [Fact]
    public void Display_WhenChordHasNamedKeys_ThenUsesFrenchNames()
    {
        var shown = ShortcutChord.Display("Ctrl+Shift+ArrowLeft");

        Assert.Equal("Ctrl+Maj+←", shown);
    }
}

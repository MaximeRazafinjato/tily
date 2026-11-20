using Tily.Core.Browser;
using Xunit;

namespace Tily.Core.Tests.Browser;

public sealed class BrowserKeysTests
{
    [Fact]
    public void Parse_WhenEnter_ThenCarriageReturnTyped()
    {
        var chord = BrowserKeys.Parse("Enter");

        Assert.Equal(("Enter", 13, "\r"), (chord.Key.Key, chord.Key.KeyCode, chord.Key.Text));
    }

    [Fact]
    public void Parse_WhenCtrlLetter_ThenNoTextAndControlPressed()
    {
        var chord = BrowserKeys.Parse("Ctrl+A");

        Assert.Equal((BrowserKeyModifiers.Ctrl, "a", "KeyA", (string?)null, "Control"), (chord.Modifiers, chord.Key.Key, chord.Key.Code, chord.Key.Text, chord.ModifierKeys.Single().Key.Key));
    }

    [Fact]
    public void Parse_WhenShiftLetter_ThenUppercaseTyped()
    {
        var chord = BrowserKeys.Parse("Shift+a");

        Assert.Equal(("A", "A"), (chord.Key.Key, chord.Key.Text));
    }

    [Fact]
    public void Parse_WhenSeveralModifiers_ThenPressedInFixedOrder()
    {
        var chord = BrowserKeys.Parse("shift+ctrl+K");

        Assert.Equal(["Control", "Shift"], chord.ModifierKeys.Select(modifier => modifier.Key.Key));
    }

    [Theory]
    [InlineData("esc", "Escape")]
    [InlineData("Échap", "Escape")]
    [InlineData("down", "ArrowDown")]
    [InlineData("F5", "F5")]
    [InlineData("1", "1")]
    [InlineData("+", "+")]
    public void Parse_WhenNameOrAlias_ThenKey(string keys, string expected)
    {
        var chord = BrowserKeys.Parse(keys);

        Assert.Equal(expected, chord.Key.Key);
    }

    [Fact]
    public void Parse_WhenPlusWithModifier_ThenPlusKey()
    {
        var chord = BrowserKeys.Parse("Ctrl++");

        Assert.Equal((BrowserKeyModifiers.Ctrl, "+"), (chord.Modifiers, chord.Key.Key));
    }

    [Fact]
    public void Parse_WhenFunctionKey_ThenVirtualKeyCode()
    {
        var chord = BrowserKeys.Parse("F5");

        Assert.Equal(116, chord.Key.KeyCode);
    }

    [Theory]
    [InlineData("Truc", "Touche inconnue")]
    [InlineData("Hyper+A", "Modificateur inconnu")]
    [InlineData("Ctrl+", "Combinaison illisible")]
    [InlineData(" ", "Indiquez la touche à presser")]
    public void Parse_WhenInvalid_ThenFailsInFrench(string keys, string expected)
    {
        var error = Assert.Throws<InvalidOperationException>(() => BrowserKeys.Parse(keys));

        Assert.StartsWith(expected, error.Message);
    }
}

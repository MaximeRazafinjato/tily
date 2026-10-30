using Tily.Core.Appearance;
using Xunit;

namespace Tily.Core.Tests.Appearance;

public sealed class HexColorTests
{
    [Theory]
    [InlineData("#7A9F8B", "#7a9f8b")]
    [InlineData("  #abc ", "#aabbcc")]
    public void Normalize_WhenValidHex_ThenLowercaseLongForm(string text, string expected)
    {
        var normalized = HexColor.Normalize(text);

        Assert.Equal(expected, normalized);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("7a9f8b")]
    [InlineData("#7a9f8")]
    [InlineData("#7a9f8g")]
    [InlineData("rgb(1, 2, 3)")]
    public void Normalize_WhenInvalid_ThenNull(string? text)
    {
        var normalized = HexColor.Normalize(text);

        Assert.Null(normalized);
    }
}

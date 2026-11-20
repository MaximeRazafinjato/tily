using Tily.Core.Appearance;
using Xunit;

namespace Tily.Core.Tests.Appearance;

public sealed class OklchColorTests
{
    [Theory]
    [InlineData("#7a9f8b")]
    [InlineData("#6a96d4")]
    [InlineData("#17191b")]
    [InlineData("#ffffff")]
    [InlineData("#000000")]
    public void ToHex_WhenConvertedFromHex_ThenRoundTrips(string hex)
    {
        var color = OklchColor.FromHex(hex);

        Assert.Equal(hex, color.ToHex());
    }

    [Fact]
    public void ToHex_WhenOutOfGamut_ThenKeepsHueWithLowerChroma()
    {
        var color = new OklchColor(0.7, 0.4, 200);

        var mapped = OklchColor.FromHex(color.ToHex());

        Assert.InRange(mapped.Chroma, 0.01, 0.4);
        Assert.InRange(mapped.Hue, 195, 205);
    }
}

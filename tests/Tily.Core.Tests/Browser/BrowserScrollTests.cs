using Tily.Core.Browser;
using Xunit;

namespace Tily.Core.Tests.Browser;

public sealed class BrowserScrollTests
{
    [Theory]
    [InlineData(null, null)]
    [InlineData(" ", null)]
    [InlineData(" Down ", "down")]
    [InlineData("left", "left")]
    public void Direction_WhenMissingOrKnown_ThenNullOrValue(string? direction, string? expected)
    {
        var value = BrowserScroll.Direction(direction);

        Assert.Equal(expected, value);
    }

    [Fact]
    public void Direction_WhenUnknown_ThenFailsInFrench()
    {
        var error = Assert.Throws<InvalidOperationException>(() => BrowserScroll.Direction("bas"));

        Assert.StartsWith("Direction inconnue", error.Message);
    }
}

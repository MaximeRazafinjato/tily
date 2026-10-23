using Tily.Core.Updates;
using Xunit;

namespace Tily.Core.Tests.Updates;

public sealed class ReleaseVersionTests
{
    [Theory]
    [InlineData("2.3.0", "2.2.0", true)]
    [InlineData("2.3.0", "2.3.0-beta.4", true)]
    [InlineData("2.3.0-beta.1", "2.2.0", true)]
    [InlineData("2.3.0-beta.10", "2.3.0-beta.9", true)]
    [InlineData("2.3.0-beta.2", "2.3.0-beta", true)]
    [InlineData("2.3.0-beta.1", "2.3.0-alpha.3", true)]
    [InlineData("2.3.0-beta.1", "2.3.0-1", true)]
    [InlineData("2.3.0-beta.1", "2.3.0-beta.1", false)]
    [InlineData("2.3.0-beta.1", "2.3.0", false)]
    [InlineData("2.3.0-beta.1", "2.3.0-beta.2", false)]
    public void IsNewer_WhenComparingVersions_ThenFollowsPrereleaseOrder(string candidate, string current, bool expected)
    {
        var newer = ReleaseVersion.IsNewer(candidate, current);

        Assert.Equal(expected, newer);
    }

    [Theory]
    [InlineData("nightly")]
    [InlineData("2.3.0-")]
    [InlineData("2.3.0-beta..1")]
    [InlineData("")]
    public void Parse_WhenTextNotAVersion_ThenNull(string text)
    {
        var version = ReleaseVersion.Parse(text);

        Assert.Null(version);
    }
}

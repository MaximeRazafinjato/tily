using Tily.Core.Updates;
using Xunit;

namespace Tily.Core.Tests.Updates;

public sealed class ReleaseHistoryTests
{
    private static ReleaseHistoryModel Entry(string version) => new(version, version.Contains('-'), null, string.Empty, []);

    [Fact]
    public void Since_WhenSeveralReleasesPublished_ThenKeepsThoseAfterCurrentUpToLatestNewestFirst()
    {
        var history = new[] { Entry("2.6.0-beta.10"), Entry("2.5.0"), Entry("2.6.0-beta.2"), Entry("2.6.0-beta.3"), Entry("2.6.0-beta.1"), Entry("2.6.0-beta.9") };

        var since = ReleaseHistory.Since(history, "2.6.0-beta.1", "2.6.0-beta.9");

        Assert.Equal(["2.6.0-beta.9", "2.6.0-beta.3", "2.6.0-beta.2"], since.Select(entry => entry.Version));
    }

    [Fact]
    public void Since_WhenCurrentVersionUnreadable_ThenReturnsNothing()
    {
        var history = new[] { Entry("1.4.0"), Entry("1.3.0") };

        var since = ReleaseHistory.Since(history, string.Empty, "1.4.0");

        Assert.Empty(since);
    }
}

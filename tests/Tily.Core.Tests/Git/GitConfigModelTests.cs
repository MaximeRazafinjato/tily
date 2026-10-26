using Tily.Core.Git;
using Xunit;

namespace Tily.Core.Tests.Git;

public sealed class GitConfigModelTests
{
    [Fact]
    public void Get_WhenSectionAndNameCaseDiffer_ThenFindsValue()
    {
        var config = GitConfigModel.Parse("branch.Feature.pushremote\nfork\0");

        var value = config.Get("branch.Feature.pushRemote");

        Assert.Equal("fork", value);
    }

    [Fact]
    public void Get_WhenSubsectionCaseDiffers_ThenNull()
    {
        var config = GitConfigModel.Parse("branch.Feature.merge\nrefs/heads/feature\0");

        var value = config.Get("branch.feature.merge");

        Assert.Null(value);
    }

    [Fact]
    public void Get_WhenKeyRepeated_ThenLastValueWins()
    {
        var config = GitConfigModel.Parse("pull.rebase\ntrue\0pull.rebase\nfalse\0");

        var value = config.Get("pull.rebase");

        Assert.Equal("false", value);
    }

    [Fact]
    public void Get_WhenKeyWithoutValue_ThenNull()
    {
        var config = GitConfigModel.Parse("branch.main.rebase\0");

        var value = config.Get("branch.main.rebase");

        Assert.Null(value);
    }
}

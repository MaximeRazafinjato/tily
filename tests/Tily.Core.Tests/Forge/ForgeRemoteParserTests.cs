using Tily.Core.Forge;
using Xunit;

namespace Tily.Core.Tests.Forge;

public sealed class ForgeRemoteParserTests
{
    private static readonly Func<string, bool> NoGitLabHost = _ => false;

    [Theory]
    [InlineData("https://github.com/MaximeRazafinjato/tily.git")]
    [InlineData("https://github.com/MaximeRazafinjato/tily")]
    [InlineData("git@github.com:MaximeRazafinjato/tily.git")]
    [InlineData("ssh://git@ssh.github.com:443/MaximeRazafinjato/tily.git")]
    public void Parse_WhenGitHubRemote_ThenFindsOwnerAndRepository(string url)
    {
        var remote = ForgeRemoteParser.Parse(url, NoGitLabHost);

        Assert.Equal(new ForgeRemoteModel(ForgeKind.GitHub, "github.com", "MaximeRazafinjato/tily", "https://github.com/MaximeRazafinjato/tily"), remote);
    }

    [Fact]
    public void Parse_WhenGitLabSubgroup_ThenKeepsFullPath()
    {
        var remote = ForgeRemoteParser.Parse("git@gitlab.com:gitlab-org/cli/sub.git", NoGitLabHost);

        Assert.Equal(new ForgeRemoteModel(ForgeKind.GitLab, "gitlab.com", "gitlab-org/cli/sub", "https://gitlab.com/gitlab-org/cli/sub"), remote);
    }

    [Fact]
    public void Parse_WhenSelfHostedGitLabDeclaredInGlab_ThenRecognizesGitLab()
    {
        var remote = ForgeRemoteParser.Parse("http://git.ftel.fr/FTELINFO/rachel.git", host => host == "git.ftel.fr");

        Assert.Equal(new ForgeRemoteModel(ForgeKind.GitLab, "git.ftel.fr", "FTELINFO/rachel", "http://git.ftel.fr/FTELINFO/rachel"), remote);
    }

    [Fact]
    public void Parse_WhenSshRemoteWithPort_ThenIgnoresPort()
    {
        var remote = ForgeRemoteParser.Parse("ssh://git@git.ftel.fr:2222/FTELINFO/clean-media.git", host => host == "git.ftel.fr");

        Assert.Equal("FTELINFO/clean-media", remote.Project);
    }

    [Fact]
    public void Parse_WhenUnknownHost_ThenFailsInFrench()
    {
        var exception = Assert.Throws<ForgeException>(() => ForgeRemoteParser.Parse("https://bitbucket.org/equipe/projet.git", NoGitLabHost));

        Assert.Equal("Hébergeur non pris en charge : bitbucket.org. Tily gère GitHub et GitLab (gitlab.com ou une instance déclarée dans glab).", exception.Message);
    }

    [Theory]
    [InlineData(@"C:\Depots\projet.git")]
    [InlineData("../projet.git")]
    public void Parse_WhenLocalRemote_ThenFailsInFrench(string url)
    {
        var exception = Assert.Throws<ForgeException>(() => ForgeRemoteParser.Parse(url, NoGitLabHost));

        Assert.Equal($"Adresse du dépôt distant « origin » non reconnue : {url}", exception.Message);
    }

    [Fact]
    public void Parse_WhenGitHubPathHasThreeSegments_ThenFails()
    {
        var exception = Assert.Throws<ForgeException>(() => ForgeRemoteParser.Parse("https://github.com/a/b/c", NoGitLabHost));

        Assert.StartsWith("Projet illisible", exception.Message);
    }
}

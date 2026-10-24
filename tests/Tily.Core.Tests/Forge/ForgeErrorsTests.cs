using Tily.Core.Forge;
using Xunit;

namespace Tily.Core.Tests.Forge;

public sealed class ForgeErrorsTests
{
    private static readonly ForgeRemoteModel GitHub = new(ForgeKind.GitHub, "github.com", "equipe/projet", "https://github.com/equipe/projet");
    private static readonly ForgeRemoteModel GitLab = new(ForgeKind.GitLab, "git.ftel.fr", "FTELINFO/rachel", "https://git.ftel.fr/FTELINFO/rachel");

    [Fact]
    public void Describe_WhenGhNotLoggedIn_ThenAsksForGhAuthLogin()
    {
        var output = new ForgeOutputModel(4, string.Empty, "To get started with GitHub CLI, please run:  gh auth login");

        var message = ForgeErrors.Describe(GitHub, output);

        Assert.Equal("« gh » n’est pas authentifié sur github.com : lancez « gh auth login » dans un terminal.", message);
    }

    [Fact]
    public void Describe_WhenGlabUnauthorized_ThenAsksForGlabAuthLoginOnHost()
    {
        var output = new ForgeOutputModel(1, "{\"message\":\"401 Unauthorized\"}", "glab: 401 Unauthorized (HTTP 401)");

        var message = ForgeErrors.Describe(GitLab, output);

        Assert.Equal("« glab » n’est pas authentifié sur git.ftel.fr : lancez « glab auth login --hostname git.ftel.fr » dans un terminal.", message);
    }

    [Fact]
    public void Describe_WhenHostUnreachable_ThenMentionsNetwork()
    {
        var output = new ForgeOutputModel(1, string.Empty, "Get \"https://git.ftel.fr/api/v4/user\": dial tcp 185.11.163.84:443: i/o timeout.");

        var message = ForgeErrors.Describe(GitLab, output);

        Assert.Equal("git.ftel.fr est injoignable : vérifiez la connexion réseau ou le VPN.", message);
    }

    [Fact]
    public void Describe_WhenRepositoryMissing_ThenSaysProjectNotFound()
    {
        var output = new ForgeOutputModel(1, string.Empty, "GraphQL: Could not resolve to a Repository with the name 'equipe/projet'. (repository)");

        var message = ForgeErrors.Describe(GitHub, output);

        Assert.Equal("Projet « equipe/projet » introuvable sur github.com, ou inaccessible au compte de « gh ».", message);
    }

    [Fact]
    public void Describe_WhenUnknownFailure_ThenQuotesFirstLine()
    {
        var output = new ForgeOutputModel(1, string.Empty, "\n   ERROR  \n\n  something odd happened\n");

        var message = ForgeErrors.Describe(GitLab, output);

        Assert.Equal("« glab » a échoué : something odd happened", message);
    }
}

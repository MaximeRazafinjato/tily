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

    [Fact]
    public void DescribeRequest_WhenGitHubSaysPullRequestExists_ThenExplainsInFrench()
    {
        var output = new ForgeOutputModel(1, """{"message":"Validation Failed","errors":[{"resource":"PullRequest","code":"custom","message":"A pull request already exists for equipe:feat/creation."}],"status":"422"}""", "gh: Validation Failed (HTTP 422)");

        var message = ForgeErrors.DescribeRequest(GitHub, output);

        Assert.Equal("Une PR ouverte existe déjà pour cette branche source sur github.com.", message);
    }

    [Fact]
    public void DescribeRequest_WhenGitHubHeadInvalid_ThenAsksToPushTheBranch()
    {
        var output = new ForgeOutputModel(1, """{"message":"Validation Failed","errors":[{"resource":"PullRequest","field":"head","code":"invalid"}],"status":"422"}""", "gh: Validation Failed (HTTP 422)");

        var message = ForgeErrors.DescribeRequest(GitHub, output);

        Assert.Equal("Branche source introuvable sur github.com : poussez-la avant de créer la PR.", message);
    }

    [Fact]
    public void DescribeRequest_WhenGitLabConflict_ThenExplainsInFrench()
    {
        var output = new ForgeOutputModel(1, """{"message":["Another open merge request already exists for this source branch: !12"]}""", "glab: 409 Conflict (HTTP 409)");

        var message = ForgeErrors.DescribeRequest(GitLab, output);

        Assert.Equal("Une MR ouverte existe déjà pour cette branche source sur git.ftel.fr.", message);
    }

    [Fact]
    public void DescribeRequest_WhenOtherValidationError_ThenQuotesFieldMessages()
    {
        var output = new ForgeOutputModel(1, """{"message":{"target_branch":["is invalid"]}}""", "glab: HTTP 400");

        var message = ForgeErrors.DescribeRequest(GitLab, output);

        Assert.Equal("git.ftel.fr refuse la MR : target_branch is invalid", message);
    }

    [Fact]
    public void DescribeRequest_WhenUnauthorized_ThenFallsBackToDescribe()
    {
        var output = new ForgeOutputModel(1, """{"message":"401 Unauthorized"}""", "glab: 401 Unauthorized (HTTP 401)");

        var message = ForgeErrors.DescribeRequest(GitLab, output);

        Assert.Equal("« glab » n’est pas authentifié sur git.ftel.fr : lancez « glab auth login --hostname git.ftel.fr » dans un terminal.", message);
    }
}

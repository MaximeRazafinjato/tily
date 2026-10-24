using Tily.Core.Forge;
using Xunit;

namespace Tily.Core.Tests.Forge;

public sealed class ForgeServiceTests
{
    private const string Origin = "https://github.com/MaximeRazafinjato/tily.git";
    private readonly string _folder = Path.GetTempPath();
    private DateTimeOffset _now = new(2026, 10, 24, 18, 0, 0, TimeSpan.Zero);

    private ForgeService ServiceWith(IForgeCommandRunner runner, string origin = Origin) =>
        new(runner, _ => origin, () => new HashSet<string>(), () => _now);

    private static FakeForgeRunner GitHubAnswering(string pullRequests) =>
        new(arguments => new ForgeOutputModel(0, arguments[0] == "api" ? "MaximeRazafinjato\n" : pullRequests, string.Empty));

    [Fact]
    public void List_WhenGitHubRemote_ThenReturnsItemsForgeAndCurrentUser()
    {
        var service = ServiceWith(GitHubAnswering(ForgeProviderTests.GitHubJson));

        var list = service.List(_folder, MergeRequestStateFilter.All);

        Assert.Equal((ForgeKind.GitHub, 2, false, "MaximeRazafinjato"), (list.Forge.Kind, list.Items.Count, list.Truncated, list.CurrentUser));
    }

    [Fact]
    public void List_WhenCalledTwice_ThenAsksCurrentUserOnce()
    {
        var runner = GitHubAnswering("[]");
        var service = ServiceWith(runner);

        service.List(_folder, MergeRequestStateFilter.Open);
        service.List(_folder, MergeRequestStateFilter.Open);

        Assert.Single(runner.Calls, call => call.Arguments[0] == "api");
    }

    [Fact]
    public void ForBranch_WhenAskedAgainWithinCacheDuration_ThenReusesResult()
    {
        var runner = GitHubAnswering(ForgeProviderTests.GitHubJson);
        var service = ServiceWith(runner);

        service.ForBranch(_folder, "feat/liste", false);
        _now += ForgeService.BranchCacheDuration - TimeSpan.FromSeconds(1);
        service.ForBranch(_folder, "feat/liste", false);

        Assert.Single(runner.Calls);
    }

    [Fact]
    public void ForBranch_WhenCacheExpiredOrForced_ThenAsksAgain()
    {
        var runner = GitHubAnswering(ForgeProviderTests.GitHubJson);
        var service = ServiceWith(runner);

        service.ForBranch(_folder, "feat/liste", false);
        service.ForBranch(_folder, "feat/liste", true);
        _now += ForgeService.BranchCacheDuration;
        service.ForBranch(_folder, "feat/liste", false);

        Assert.Equal(3, runner.Calls.Count);
    }

    [Fact]
    public void ForBranch_WhenHostAnswersOtherBranches_ThenKeepsOnlyExactSourceBranch()
    {
        var service = ServiceWith(GitHubAnswering(ForgeProviderTests.GitHubJson));

        var result = service.ForBranch(_folder, "feat/liste", false);

        Assert.Equal(["#158"], result.Items.Select(item => item.Reference));
    }

    [Fact]
    public void ForBranch_WhenHostUnsupported_ThenReturnsErrorAndCachesItLonger()
    {
        var runner = GitHubAnswering("[]");
        var origins = 0;
        var service = new ForgeService(runner, _ => { origins++; return "https://bitbucket.org/equipe/projet.git"; }, () => new HashSet<string>(), () => _now);

        var result = service.ForBranch(_folder, "main", false);
        _now += ForgeService.BranchCacheDuration;
        service.ForBranch(_folder, "main", false);

        Assert.Equal((true, 1, 0), (result.Error!.StartsWith("Hébergeur non pris en charge", StringComparison.Ordinal), origins, runner.Calls.Count));
    }

    [Fact]
    public void Detect_WhenHostDeclaredInGlab_ThenGitLab()
    {
        var service = new ForgeService(GitHubAnswering("[]"), _ => "git@git.ftel.fr:FTELINFO/rachel.git", () => new HashSet<string>(["git.ftel.fr"]), () => _now);

        var remote = service.Detect(_folder);

        Assert.Equal(ForgeKind.GitLab, remote.Kind);
    }
}

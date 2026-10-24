using Tily.Core.Forge;
using Xunit;

namespace Tily.Core.Tests.Forge;

public sealed class ForgeProviderTests
{
    public const string GitHubJson = """
        [
          {"assignees":[{"login":"alice","name":""}],"author":{"login":"MaximeRazafinjato","name":"Maxime Razafinjato"},"baseRefName":"develop","createdAt":"2026-10-24T16:23:01Z","headRefName":"feat/liste","isDraft":true,"labels":[{"name":"enhancement","color":"a2eeef"}],"number":158,"reviewDecision":"CHANGES_REQUESTED","reviewRequests":[{"login":"bob"},{"slug":"equipe-web","name":"Équipe web"}],"state":"OPEN","title":"✨ Liste des MR","updatedAt":"2026-10-24T17:00:00Z","url":"https://github.com/MaximeRazafinjato/tily/pull/158"},
          {"assignees":[],"author":{"login":"carol","name":"Carol"},"baseRefName":"main","createdAt":"2026-10-20T10:00:00Z","headRefName":"fix/ancien","isDraft":false,"labels":[],"number":12,"reviewDecision":"","reviewRequests":[],"state":"MERGED","title":"Ancien","updatedAt":"2026-10-21T10:00:00Z","url":"https://github.com/MaximeRazafinjato/tily/pull/12"}
        ]
        """;

    public const string GitLabJson = """
        [
          {"iid":4201,"title":"fix(mr): retries","state":"opened","created_at":"2026-10-24T14:06:45.744Z","updated_at":"2026-10-24T14:10:25.787Z","target_branch":"main","source_branch":"jmrp-mr-for-branch-retries","author":{"username":"jmrp","name":"José M. Requena Plens"},"assignees":[{"username":"jmrp","name":"José M. Requena Plens"}],"reviewers":[{"username":"jay_mccure","name":"Jay McCure"}],"labels":["type::bug","workflow::ready for review"],"draft":false,"work_in_progress":false,"detailed_merge_status":"not_approved","web_url":"https://gitlab.com/gitlab-org/cli/-/merge_requests/4201"}
        ]
        """;

    private static readonly ForgeRemoteModel GitHubRemote = new(ForgeKind.GitHub, "github.com", "MaximeRazafinjato/tily", "https://github.com/MaximeRazafinjato/tily");
    private static readonly ForgeRemoteModel GitLabRemote = new(ForgeKind.GitLab, "gitlab.com", "gitlab-org/cli", "https://gitlab.com/gitlab-org/cli");

    [Fact]
    public void GitHubParse_WhenPullRequests_ThenReadsEveryField()
    {
        var item = GitHubProvider.Parse(GitHubJson, "github.com")[0];

        Assert.Equal(
            new
            {
                item.Reference, item.State, item.Draft, item.Review, Author = item.Author.Name, Assignee = item.Assignees.Single().Name,
                Reviewers = string.Join(',', item.Reviewers.Select(user => user.Name)), Labels = string.Join(',', item.Labels), item.SourceBranch, item.TargetBranch
            },
            new
            {
                Reference = "#158", State = MergeRequestState.Open, Draft = true, Review = MergeRequestReview.ChangesRequested, Author = "Maxime Razafinjato", Assignee = "alice",
                Reviewers = "bob,Équipe web", Labels = "enhancement", SourceBranch = "feat/liste", TargetBranch = "develop"
            });
    }

    [Fact]
    public void GitHubParse_WhenSeveralItems_ThenMostRecentlyUpdatedFirstAndMergedRead()
    {
        var items = GitHubProvider.Parse(GitHubJson, "github.com");

        Assert.Equal([(158, MergeRequestState.Open), (12, MergeRequestState.Merged)], items.Select(item => (item.Number, item.State)));
    }

    [Fact]
    public void GitLabParse_WhenMergeRequests_ThenReadsEveryField()
    {
        var item = GitLabProvider.Parse(GitLabJson, "gitlab.com").Single();

        Assert.Equal(
            new { item.Reference, item.State, item.Review, Author = item.Author.Login, Reviewer = item.Reviewers.Single().Login, Labels = string.Join(',', item.Labels), item.Url },
            new { Reference = "!4201", State = MergeRequestState.Open, Review = MergeRequestReview.ReviewRequired, Author = "jmrp", Reviewer = "jay_mccure", Labels = "type::bug,workflow::ready for review", Url = "https://gitlab.com/gitlab-org/cli/-/merge_requests/4201" });
    }

    [Fact]
    public void Parse_WhenNotJson_ThenFailsInFrench()
    {
        var exception = Assert.Throws<ForgeException>(() => GitLabProvider.Parse("<html>", "gitlab.com"));

        Assert.Equal("Réponse de gitlab.com illisible.", exception.Message);
    }

    [Fact]
    public void GitHubList_WhenBranchGiven_ThenAsksGhForThatHead()
    {
        var runner = FakeForgeRunner.Answering("[]");

        new GitHubProvider(runner).List(GitHubRemote, ".", new MergeRequestQueryModel(MergeRequestStateFilter.Open, 20, "feat/liste"));

        Assert.Equal(
            "pr list --repo github.com/MaximeRazafinjato/tily --state open --limit 20 --json number,title,state,isDraft,author,assignees,labels,headRefName,baseRefName,url,createdAt,updatedAt,reviewDecision,reviewRequests --head feat/liste",
            string.Join(' ', runner.Calls.Single().Arguments));
    }

    [Fact]
    public void GitLabList_WhenBranchGiven_ThenEncodesProjectAndBranch()
    {
        var runner = FakeForgeRunner.Answering("[]");

        new GitLabProvider(runner).List(GitLabRemote, ".", new MergeRequestQueryModel(MergeRequestStateFilter.Merged, 100, "feat/é"));

        Assert.Equal(
            "api projects/gitlab-org%2Fcli/merge_requests?state=merged&per_page=100&order_by=updated_at&sort=desc&source_branch=feat%2F%C3%A9 --hostname gitlab.com",
            string.Join(' ', runner.Calls.Single().Arguments));
    }

    [Fact]
    public void List_WhenCliFails_ThenThrowsDescribedError()
    {
        var runner = new FakeForgeRunner(_ => new ForgeOutputModel(1, string.Empty, "glab: 401 Unauthorized (HTTP 401)"));

        var exception = Assert.Throws<ForgeException>(() => new GitLabProvider(runner).List(GitLabRemote, ".", new MergeRequestQueryModel(MergeRequestStateFilter.Open, 100)));

        Assert.Equal("« glab » n’est pas authentifié sur gitlab.com : lancez « glab auth login --hostname gitlab.com » dans un terminal.", exception.Message);
    }

    private static readonly MergeRequestInputModel Creation = new("feat/creation", "develop", "Créer des MR/PR", "## Résumé", ["bob", "carol"], "alice", ["enhancement", "git"], true);

    [Fact]
    public void GitHubCreate_WhenEverythingSet_ThenCreatesThenAssignsAndRequestsReviewers()
    {
        var runner = new FakeForgeRunner(arguments => new ForgeOutputModel(0, arguments[3].EndsWith("/pulls", StringComparison.Ordinal) ? """{"number":42,"html_url":"https://github.com/MaximeRazafinjato/tily/pull/42"}""" : "{}", string.Empty));

        var created = new GitHubProvider(runner).Create(GitHubRemote, ".", Creation);

        Assert.Equal(
            (42, "#42", "https://github.com/MaximeRazafinjato/tily/pull/42", 0, "repos/MaximeRazafinjato/tily/pulls POST,repos/MaximeRazafinjato/tily/issues/42 PATCH,repos/MaximeRazafinjato/tily/pulls/42/requested_reviewers POST"),
            (created.Number, created.Reference, created.Url, created.Warnings.Count, string.Join(',', runner.Calls.Select(call => $"{call.Arguments[3]} {call.Arguments[5]}"))));
    }

    [Fact]
    public void GitHubCreate_WhenCreating_ThenSendsJsonBodyOnStandardInput()
    {
        var runner = FakeForgeRunner.Answering("""{"number":42,"html_url":"u"}""");

        new GitHubProvider(runner).Create(GitHubRemote, ".", Creation with { Assignee = null, Labels = [], Reviewers = [] });

        Assert.Equal(
            ("""{"title":"Créer des MR/PR","body":"## Résumé","head":"feat/creation","base":"develop","draft":true}""", "--input -"),
            (runner.Inputs.Single(), string.Join(' ', runner.Calls.Single().Arguments.TakeLast(2))));
    }

    [Fact]
    public void GitHubCreate_WhenReviewersRefused_ThenKeepsPullRequestWithWarning()
    {
        var runner = new FakeForgeRunner(arguments => arguments[3].EndsWith("/requested_reviewers", StringComparison.Ordinal)
            ? new ForgeOutputModel(1, """{"message":"Reviews may only be requested from collaborators."}""", "gh: Reviews may only be requested from collaborators. (HTTP 422)")
            : new ForgeOutputModel(0, """{"number":42,"html_url":"u"}""", string.Empty));

        var created = new GitHubProvider(runner).Create(GitHubRemote, ".", Creation);

        Assert.Equal(["Reviewers non ajoutés : github.com refuse la PR : Reviews may only be requested from collaborators."], created.Warnings);
    }

    [Fact]
    public void GitHubCreate_WhenRefused_ThenThrowsDescribedError()
    {
        var runner = new FakeForgeRunner(_ => new ForgeOutputModel(1, """{"message":"Validation Failed","errors":[{"resource":"PullRequest","code":"custom","message":"No commits between develop and feat/creation"}]}""", "gh: Validation Failed (HTTP 422)"));

        var exception = Assert.Throws<ForgeException>(() => new GitHubProvider(runner).Create(GitHubRemote, ".", Creation));

        Assert.Equal("Aucun commit à fusionner entre la branche source et la branche cible.", exception.Message);
    }

    [Fact]
    public void GitHubMembers_WhenFullPage_ThenReadsNextPageAndSortsLogins()
    {
        var firstPage = $"[{string.Join(',', Enumerable.Range(0, 100).Select(index => $"{{\"login\":\"user{index:000}\"}}"))}]";
        var runner = new FakeForgeRunner(arguments => new ForgeOutputModel(0, arguments[3].EndsWith("page=1", StringComparison.Ordinal) ? firstPage : """[{"login":"Alice"}]""", string.Empty));

        var members = new GitHubProvider(runner).Members(GitHubRemote, ".");

        Assert.Equal((101, "Alice", 2), (members.Count, members[0].Login, runner.Calls.Count));
    }

    [Fact]
    public void GitHubLabels_WhenColorWithoutHash_ThenAddsIt()
    {
        var runner = FakeForgeRunner.Answering("""[{"name":"enhancement","color":"a2eeef","description":"New feature"}]""");

        var label = new GitHubProvider(runner).Labels(GitHubRemote, ".").Single();

        Assert.Equal(new ForgeLabelModel("enhancement", "#a2eeef", "New feature"), label);
    }

    [Fact]
    public void GitLabCreate_WhenUsersGiven_ThenResolvesIdsAndPrefixesDraft()
    {
        var runner = new FakeForgeRunner(arguments => new ForgeOutputModel(0, arguments[1] switch
        {
            "users?username=alice" => """[{"id":7}]""",
            "users?username=bob" => """[{"id":8}]""",
            "users?username=carol" => "[]",
            _ => """{"iid":12,"web_url":"https://gitlab.com/gitlab-org/cli/-/merge_requests/12"}"""
        }, string.Empty));

        var created = new GitLabProvider(runner).Create(GitLabRemote, ".", Creation);

        Assert.Equal(
            ("!12", """{"source_branch":"feat/creation","target_branch":"develop","title":"Draft: Créer des MR/PR","description":"## Résumé","assignee_ids":[7],"reviewer_ids":[8],"labels":"enhancement,git"}""", "Utilisateur « carol » introuvable sur gitlab.com : ignoré."),
            (created.Reference, runner.Inputs.Last(), created.Warnings.Single()));
    }

    [Fact]
    public void GitLabMembers_WhenInheritedDuplicatesAndBlocked_ThenKeepsActiveOnce()
    {
        var runner = FakeForgeRunner.Answering("""[{"username":"zoe","name":"Zoé","state":"active"},{"username":"bot","name":"Bot","state":"blocked"},{"username":"zoe","name":"Zoé","state":"active"},{"username":"adam","name":"Adam","state":"active"}]""");

        var members = new GitLabProvider(runner).Members(GitLabRemote, ".");

        Assert.Equal(["adam", "zoe"], members.Select(member => member.Login));
    }

    [Fact]
    public void GitLabDefaultBranch_WhenProjectRead_ThenReturnsDefaultBranch()
    {
        var runner = FakeForgeRunner.Answering("""{"id":1,"default_branch":"master"}""");

        var branch = new GitLabProvider(runner).DefaultBranch(GitLabRemote, ".");

        Assert.Equal(("master", "api projects/gitlab-org%2Fcli --hostname gitlab.com"), (branch, string.Join(' ', runner.Calls.Single().Arguments)));
    }
}

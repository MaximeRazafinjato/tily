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
}

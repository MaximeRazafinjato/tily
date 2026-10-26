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

        new GitHubProvider(runner).List(GitHubRemote, ".", new MergeRequestQueryModel(20, "feat/liste"));

        Assert.Equal(
            "pr list --repo github.com/MaximeRazafinjato/tily --state open --limit 20 --json number,title,state,isDraft,author,assignees,labels,headRefName,baseRefName,url,createdAt,updatedAt,reviewDecision,reviewRequests --head feat/liste",
            string.Join(' ', runner.Calls.Single().Arguments));
    }

    [Fact]
    public void GitLabList_WhenBranchGiven_ThenEncodesProjectAndBranch()
    {
        var runner = FakeForgeRunner.Answering("[]");

        new GitLabProvider(runner).List(GitLabRemote, ".", new MergeRequestQueryModel(100, "feat/é"));

        Assert.Equal(
            "api projects/gitlab-org%2Fcli/merge_requests?state=opened&per_page=100&order_by=updated_at&sort=desc&source_branch=feat%2F%C3%A9 --hostname gitlab.com",
            string.Join(' ', runner.Calls.Single().Arguments));
    }

    [Fact]
    public void List_WhenCliFails_ThenThrowsDescribedError()
    {
        var runner = new FakeForgeRunner(_ => new ForgeOutputModel(1, string.Empty, "glab: 401 Unauthorized (HTTP 401)"));

        var exception = Assert.Throws<ForgeException>(() => new GitLabProvider(runner).List(GitLabRemote, ".", new MergeRequestQueryModel(100)));

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

    private const string GitHubDetailJson = """
        {"assignees":[{"login":"alice","name":"Alice"},{"login":"dave","name":""}],"author":{"login":"MaximeRazafinjato","name":"Maxime Razafinjato"},"baseRefName":"develop","body":"## Résumé","createdAt":"2026-10-24T16:23:01Z","headRefName":"feat/modification","isDraft":true,"labels":[{"name":"git"}],"number":157,"reviewDecision":"","reviewRequests":[{"login":"bob"},{"slug":"equipe-web","name":"Équipe web"}],"state":"OPEN","title":"Modifier des MR/PR","updatedAt":"2026-10-24T17:00:00Z","url":"https://github.com/MaximeRazafinjato/tily/pull/157"}
        """;

    private static readonly MergeRequestInputModel Edition = new("feat/modification", "develop", "Modifier des MR/PR", "## Résumé", ["bob"], "alice", ["git"], true);

    [Fact]
    public void GitHubGet_WhenPullRequestRead_ThenKeepsBodyAndUserReviewersOnly()
    {
        var runner = FakeForgeRunner.Answering(GitHubDetailJson);

        var detail = new GitHubProvider(runner).Get(GitHubRemote, ".", 157);

        Assert.Equal(
            ("## Résumé", "bob", "Modifier des MR/PR", 2, "pr view 157 --repo github.com/MaximeRazafinjato/tily"),
            (detail.Description, string.Join(',', detail.Reviewers), detail.Title, detail.Item.Assignees.Count, string.Join(' ', runner.Calls.Single().Arguments.Take(5))));
    }

    [Fact]
    public void GitHubUpdate_WhenSomeFieldsChanged_ThenSendsOnlyThem()
    {
        var runner = FakeForgeRunner.Answering("{}");
        var changes = MergeRequestChanges.Between(157, Edition, Edition with { Title = "Modifier les MR/PR", Reviewers = ["carol"], Labels = ["git", "enhancement"], Draft = false }, false);

        var updated = new GitHubProvider(runner).Update(GitHubRemote, ".", changes);

        Assert.Equal(
            ("#157", 0, "repos/MaximeRazafinjato/tily/pulls/157 PATCH,repos/MaximeRazafinjato/tily/issues/157 PATCH,repos/MaximeRazafinjato/tily/pulls/157/requested_reviewers DELETE,repos/MaximeRazafinjato/tily/pulls/157/requested_reviewers POST,ready 157",
                """{"title":"Modifier les MR/PR"}""", """{"labels":["git","enhancement"]}""", """{"reviewers":["bob"]}"""),
            (updated.Reference, updated.Warnings.Count, string.Join(',', runner.Calls.Select(call => call.Arguments[0] == "pr" ? $"{call.Arguments[1]} {call.Arguments[2]}" : $"{call.Arguments[3]} {call.Arguments[5]}")),
                runner.Inputs[0], runner.Inputs[1], runner.Inputs[2]));
    }

    [Fact]
    public void GitHubUpdate_WhenDraftAsked_ThenUndoesReadyAndClearsAssignee()
    {
        var runner = FakeForgeRunner.Answering("{}");
        var changes = MergeRequestChanges.Between(157, Edition with { Draft = false }, Edition with { Assignee = null }, false);

        new GitHubProvider(runner).Update(GitHubRemote, ".", changes);

        Assert.Equal(
            ("""{"assignees":[]}""", "pr ready 157 --repo github.com/MaximeRazafinjato/tily --undo"),
            (runner.Inputs[0], string.Join(' ', runner.Calls[1].Arguments)));
    }

    [Fact]
    public void GitHubUpdate_WhenClosing_ThenClosesWithEditsAndSkipsDraft()
    {
        var runner = FakeForgeRunner.Answering("{}");
        var changes = MergeRequestChanges.Between(157, Edition, Edition with { TargetBranch = "main", Draft = false }, true);

        var updated = new GitHubProvider(runner).Update(GitHubRemote, ".", changes);

        Assert.Equal((true, 1, """{"base":"main","state":"closed"}"""), (updated.Closed, runner.Calls.Count, runner.Inputs.Single()));
    }

    [Fact]
    public void GitHubUpdate_WhenMainChangeRefused_ThenThrowsWithoutOtherCalls()
    {
        var runner = new FakeForgeRunner(_ => new ForgeOutputModel(1, """{"message":"Validation Failed","errors":[{"resource":"PullRequest","field":"base","code":"invalid"}]}""", "gh: Validation Failed (HTTP 422)"));
        var changes = MergeRequestChanges.Between(157, Edition, Edition with { TargetBranch = "absente", Labels = [] }, false);

        var exception = Assert.Throws<ForgeException>(() => new GitHubProvider(runner).Update(GitHubRemote, ".", changes));

        Assert.Equal(("Branche cible introuvable sur github.com.", 1), (exception.Message, runner.Calls.Count));
    }

    [Fact]
    public void GitHubUpdate_WhenReadyRefused_ThenWarns()
    {
        var runner = new FakeForgeRunner(arguments => arguments[0] == "pr" ? new ForgeOutputModel(1, string.Empty, "Draft pull requests are not supported in this repository.") : new ForgeOutputModel(0, "{}", string.Empty));
        var changes = MergeRequestChanges.Between(157, Edition with { Draft = false }, Edition, false);

        var updated = new GitHubProvider(runner).Update(GitHubRemote, ".", changes);

        Assert.Equal(["Passage en brouillon impossible : « gh » a échoué : Draft pull requests are not supported in this repository."], updated.Warnings);
    }

    [Fact]
    public void GitLabGet_WhenDraft_ThenStripsDraftPrefixFromTitle()
    {
        var runner = FakeForgeRunner.Answering("""{"iid":12,"title":"Draft: [Draft] Modifier des MR/PR","description":"Corps","state":"opened","draft":true,"source_branch":"feat/modification","target_branch":"main","reviewers":[{"username":"bob","name":"Bob"}],"assignees":[],"labels":["git"],"web_url":"u"}""");

        var detail = new GitLabProvider(runner).Get(GitLabRemote, ".", 12);

        Assert.Equal(
            ("Modifier des MR/PR", "Corps", "bob", "api projects/gitlab-org%2Fcli/merge_requests/12 --hostname gitlab.com"),
            (detail.Title, detail.Description, string.Join(',', detail.Reviewers), string.Join(' ', runner.Calls.Single().Arguments)));
    }

    [Fact]
    public void GitLabUpdate_WhenChanged_ThenPutsOnlyChangedFieldsInOneCall()
    {
        var runner = new FakeForgeRunner(arguments => new ForgeOutputModel(0, arguments[1] == "users?username=carol" ? """[{"id":9}]""" : "{}", string.Empty));
        var changes = MergeRequestChanges.Between(12, Edition with { Draft = false }, Edition with { Reviewers = ["carol"], Labels = [] }, true);

        var updated = new GitLabProvider(runner).Update(GitLabRemote, ".", changes);

        Assert.Equal(
            ("!12", true, """{"title":"Draft: Modifier des MR/PR","reviewer_ids":[9],"labels":"","state_event":"close"}""", "api projects/gitlab-org%2Fcli/merge_requests/12 --method PUT --input - --hostname gitlab.com"),
            (updated.Reference, updated.Closed, runner.Inputs.Last(), string.Join(' ', runner.Calls.Last().Arguments)));
    }
}

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

        var list = service.List(_folder);

        Assert.Equal((ForgeKind.GitHub, 2, false, "MaximeRazafinjato"), (list.Forge.Kind, list.Items.Count, list.Truncated, list.CurrentUser));
    }

    [Fact]
    public void List_WhenCalledTwice_ThenAsksCurrentUserOnce()
    {
        var runner = GitHubAnswering("[]");
        var service = ServiceWith(runner);

        service.List(_folder);
        service.List(_folder);

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

    private static readonly MergeRequestInputModel Creation = new("feat/creation", "develop", "Créer des MR/PR", string.Empty, [], null, [], false);

    private ForgeService FormServiceWith(IForgeCommandRunner runner, FakeMergeRequestGit git, string baseBranch = "develop") =>
        new(runner, _ => Origin, () => new HashSet<string>(), () => _now, _ => git, () => baseBranch);

    private static FakeForgeRunner GitHubForm(bool failing = false) => new(arguments =>
    {
        var path = arguments[0] != "api" ? string.Empty : arguments[1] == "--hostname" ? arguments[3] : arguments[1];
        if (failing && path.StartsWith("repos/", StringComparison.Ordinal))
        {
            return new ForgeOutputModel(1, string.Empty, "dial tcp: lookup api.github.com: no such host");
        }

        return new ForgeOutputModel(0, path switch
        {
            "user" => "MaximeRazafinjato\n",
            "repos/MaximeRazafinjato/tily" => "main\n",
            _ when path.Contains("/assignees", StringComparison.Ordinal) => """[{"login":"MaximeRazafinjato"},{"login":"alice"}]""",
            _ when path.Contains("/labels", StringComparison.Ordinal) => """[{"name":"git","color":"762ccc"}]""",
            _ when path.EndsWith("/pulls", StringComparison.Ordinal) => """{"number":42,"html_url":"https://github.com/MaximeRazafinjato/tily/pull/42"}""",
            _ => "[]"
        }, string.Empty);
    });

    [Fact]
    public void FormData_WhenOpenedOnBranch_ThenGathersMembersLabelsAndSuggestion()
    {
        var service = FormServiceWith(GitHubForm(), new FakeMergeRequestGit());

        var form = service.FormData(_folder, null);

        Assert.Equal(
            ("MaximeRazafinjato", "alice,MaximeRazafinjato", "git", "develop", "feat/creation", "✨ Créer des MR/PR", "Formulaire complet.", "develop,feat/creation,main", 0),
            (form.CurrentUser, string.Join(',', form.Members.Select(member => member.Login)), form.Labels.Single().Name, form.DefaultTarget, form.Branch.Source, form.Branch.Title, form.Branch.Description, string.Join(',', form.SourceBranches), form.Warnings.Count));
    }

    [Fact]
    public void FormData_WhenEveryForgeReadFails_ThenFailsWithFirstError()
    {
        var service = FormServiceWith(GitHubForm(failing: true), new FakeMergeRequestGit());

        var exception = Assert.Throws<ForgeException>(() => service.FormData(_folder, null));

        Assert.Equal("github.com est injoignable : vérifiez la connexion réseau ou le VPN.", exception.Message);
    }

    [Fact]
    public void DefaultTarget_WhenConfiguredBaseOnOrigin_ThenPrefersIt()
    {
        var target = ForgeService.DefaultTarget("feat/creation", ["develop", "main"], "develop", "main");

        Assert.Equal("develop", target);
    }

    [Fact]
    public void DefaultTarget_WhenConfiguredBaseMissingOrIsSource_ThenFallsBackToForgeDefault()
    {
        var targets = (ForgeService.DefaultTarget("feat/creation", ["main"], "develop", "main"), ForgeService.DefaultTarget("develop", ["develop", "main"], "develop", "main"));

        Assert.Equal(("main", "main"), targets);
    }

    [Fact]
    public void BranchInfo_WhenSourceUnknown_ThenReportsError()
    {
        var service = FormServiceWith(GitHubForm(), new FakeMergeRequestGit());

        var info = service.BranchInfo(_folder, "feat/absente", "develop");

        Assert.Equal("Branche source « feat/absente » introuvable, ni en local ni sur origin.", info.Error);
    }

    [Fact]
    public void Create_WhenBranchUnpublishedAndPushAsked_ThenPushesThenCreates()
    {
        var git = new FakeMergeRequestGit();
        var service = FormServiceWith(GitHubForm(), git);

        var created = service.Create(_folder, Creation, true);

        Assert.Equal(("feat/creation", "#42"), (string.Join(',', git.Pushed), created.Reference));
    }

    [Fact]
    public void Create_WhenBranchUnpublishedAndPushDeclined_ThenRefusesWithoutCallingForge()
    {
        var runner = GitHubForm();
        var service = FormServiceWith(runner, new FakeMergeRequestGit());

        var exception = Assert.Throws<ForgeException>(() => service.Create(_folder, Creation, false));

        Assert.Equal(("La branche « feat/creation » n’est pas publiée sur origin : cochez « Pousser la branche avant de créer » ou faites le push vous-même.", 0), (exception.Message, runner.Calls.Count));
    }

    [Fact]
    public void Create_WhenBranchUpToDate_ThenDoesNotPush()
    {
        var git = new FakeMergeRequestGit();
        git.Publications["feat/creation"] = new BranchPublicationModel(true, true, 0);
        var service = FormServiceWith(GitHubForm(), git);

        service.Create(_folder, Creation, true);

        Assert.Empty(git.Pushed);
    }

    [Fact]
    public void ForBranch_WhenNoOpenMergeRequest_ThenCreatableExceptOnBaseBranches()
    {
        var service = FormServiceWith(GitHubAnswering("[]"), new FakeMergeRequestGit());

        var creatable = (service.ForBranch(_folder, "feat/creation", false).Creatable, service.ForBranch(_folder, "develop", false).Creatable, service.ForBranch(_folder, "main", false).Creatable);

        Assert.Equal((true, false, false), creatable);
    }

    private static readonly MergeRequestInputModel Edition = new("feat/creation", "main", "Modifier des MR/PR", "Résumé", ["bob"], "alice", ["git"], false);

    private static FakeForgeRunner GitHubEdit(string state = "OPEN")
    {
        var form = GitHubForm();
        return new FakeForgeRunner(arguments => arguments[0] == "pr" && arguments[1] == "view"
            ? new ForgeOutputModel(0, $$"""{"number":157,"title":"Modifier des MR/PR","body":"Résumé\r\n","state":"{{state}}","isDraft":true,"headRefName":"feat/creation","baseRefName":"main","assignees":[{"login":"alice"},{"login":"dave"}],"reviewRequests":[{"login":"bob"}],"labels":[{"name":"git"}],"url":"https://github.com/MaximeRazafinjato/tily/pull/157"}""", string.Empty)
            : form.Run(ForgeKind.GitHub, ".", arguments));
    }

    [Fact]
    public void FormData_WhenEditing_ThenPrefillsFromMergeRequestAndKeepsItsTarget()
    {
        var service = FormServiceWith(GitHubEdit(), new FakeMergeRequestGit { Current = "main" });

        var form = service.FormData(_folder, null, 157);

        Assert.Equal(
            ("#157", "feat/creation", "main", "Résumé", "alice", "alice,dave", true, "feat/creation", "main"),
            (form.Edit?.Reference, form.Edit?.Input.SourceBranch, form.Edit?.Input.TargetBranch, form.Edit?.Input.Description, form.Edit?.Input.Assignee, string.Join(',', form.Edit?.Assignees.Select(user => user.Login) ?? []), form.Edit?.Input.Draft, form.Branch.Source, form.Branch.Target));
    }

    [Fact]
    public void FormData_WhenEditingMergedPullRequest_ThenRefuses()
    {
        var service = FormServiceWith(GitHubEdit("MERGED"), new FakeMergeRequestGit());

        var exception = Assert.Throws<ForgeException>(() => service.FormData(_folder, null, 157));

        Assert.Equal("La PR #157 est fusionnée : seules les PR ouvertes se modifient.", exception.Message);
    }

    [Fact]
    public void BranchInfo_WhenEditingFromUnknownSource_ThenNoErrorAndExcludesEditedMergeRequest()
    {
        var service = FormServiceWith(GitHubAnswering("""[{"number":157,"headRefName":"feat/fork","state":"OPEN"}]"""), new FakeMergeRequestGit());

        var info = service.BranchInfo(_folder, "feat/fork", "main", 157);

        Assert.Equal((null, 0), (info.Error, info.Existing.Count));
    }

    [Fact]
    public void Update_WhenNothingChanged_ThenRefusesWithoutCallingForge()
    {
        var runner = GitHubForm();
        var service = FormServiceWith(runner, new FakeMergeRequestGit());

        var exception = Assert.Throws<ForgeException>(() => service.Update(_folder, 157, Edition, Edition, false, false));

        Assert.Equal(("Aucune modification à enregistrer.", 0), (exception.Message, runner.Calls.Count));
    }

    [Fact]
    public void Update_WhenOnlyPushAsked_ThenPushesWithoutCallingForge()
    {
        var git = new FakeMergeRequestGit();
        git.Publications["feat/creation"] = new BranchPublicationModel(true, true, 2);
        var runner = GitHubForm();
        var service = FormServiceWith(runner, git);

        var updated = service.Update(_folder, 157, Edition, Edition, true, false);

        Assert.Equal(("feat/creation", "#157", 0), (string.Join(',', git.Pushed), updated.Reference, runner.Calls.Count));
    }

    [Fact]
    public void Update_WhenTitleChanged_ThenPatchesPullRequest()
    {
        var runner = GitHubForm();
        var service = FormServiceWith(runner, new FakeMergeRequestGit());

        service.Update(_folder, 157, Edition, Edition with { Title = "Nouveau titre" }, false, false);

        Assert.Equal(("repos/MaximeRazafinjato/tily/pulls/157", """{"title":"Nouveau titre"}"""), (runner.Calls.Single().Arguments[3], runner.Inputs.Single()));
    }
}

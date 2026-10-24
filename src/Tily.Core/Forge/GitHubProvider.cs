using System.Globalization;
using System.Text.Json;

namespace Tily.Core.Forge;

public sealed class GitHubProvider(IForgeCommandRunner runner) : IForgeProvider
{
    private const string Fields = "number,title,state,isDraft,author,assignees,labels,headRefName,baseRefName,url,createdAt,updatedAt,reviewDecision,reviewRequests";

    public IReadOnlyList<MergeRequestModel> List(ForgeRemoteModel remote, string directory, MergeRequestQueryModel query)
    {
        List<string> arguments = ["pr", "list", "--repo", $"{remote.Host}/{remote.Project}", "--state", StateArgument(query.State), "--limit", query.Limit.ToString(CultureInfo.InvariantCulture), "--json", Fields];
        if (query.SourceBranch is { } branch)
        {
            arguments.AddRange(["--head", branch]);
        }

        var output = runner.Run(ForgeKind.GitHub, directory, arguments);
        return output.Succeeded ? Parse(output.Output, remote.Host) : throw new ForgeException(ForgeErrors.Describe(remote, output));
    }

    public string? CurrentUser(ForgeRemoteModel remote, string directory)
    {
        var output = runner.Run(ForgeKind.GitHub, directory, ["api", "user", "--hostname", remote.Host, "--jq", ".login"]);
        var login = output.Output.Trim();
        return output.Succeeded && login.Length > 0 ? login : null;
    }

    public IReadOnlyList<ForgeUserModel> Members(ForgeRemoteModel remote, string directory) =>
        ForgeJson.ReadPages(remote, page => Api(remote, directory, $"{Repository(remote)}/assignees?{PageQuery(page)}"), Member)
            .OrderBy(user => user.Login, StringComparer.OrdinalIgnoreCase)
            .ToList();

    public IReadOnlyList<ForgeLabelModel> Labels(ForgeRemoteModel remote, string directory) =>
        ForgeJson.ReadPages(remote, page => Api(remote, directory, $"{Repository(remote)}/labels?{PageQuery(page)}"), Label);

    public string? DefaultBranch(ForgeRemoteModel remote, string directory)
    {
        var output = Api(remote, directory, Repository(remote), "--jq", ".default_branch");
        var branch = output.Output.Trim();
        return output.Succeeded && branch.Length > 0 ? branch : throw new ForgeException(ForgeErrors.Describe(remote, output));
    }

    public MergeRequestCreatedModel Create(ForgeRemoteModel remote, string directory, MergeRequestInputModel input)
    {
        var body = ForgeJson.Serialize(new { title = input.Title, body = input.Description, head = input.SourceBranch, @base = input.TargetBranch, draft = input.Draft });
        var output = Send(remote, directory, $"{Repository(remote)}/pulls", "POST", body);
        if (!output.Succeeded)
        {
            throw new ForgeException(ForgeErrors.DescribeRequest(remote, output));
        }

        var (number, url) = ForgeJson.ReadObject(output.Output, remote.Host, root => (ForgeJson.Number(root, "number"), ForgeJson.Text(root, "html_url")));
        if (number <= 0)
        {
            throw new ForgeException($"Réponse de {remote.Host} illisible.");
        }

        var warnings = new List<string>();
        if (input.Assignee is not null || input.Labels.Count > 0)
        {
            var issue = new Dictionary<string, object>();
            if (input.Assignee is { } assignee)
            {
                issue["assignees"] = new[] { assignee };
            }

            if (input.Labels.Count > 0)
            {
                issue["labels"] = input.Labels;
            }

            var applied = Send(remote, directory, $"{Repository(remote)}/issues/{number}", "PATCH", ForgeJson.Serialize(issue));
            if (!applied.Succeeded)
            {
                warnings.Add($"Assigné et labels non appliqués : {ForgeErrors.DescribeRequest(remote, applied)}");
            }
        }

        if (input.Reviewers.Count > 0)
        {
            var requested = Send(remote, directory, $"{Repository(remote)}/pulls/{number}/requested_reviewers", "POST", ForgeJson.Serialize(new { reviewers = input.Reviewers }));
            if (!requested.Succeeded)
            {
                warnings.Add($"Reviewers non ajoutés : {ForgeErrors.DescribeRequest(remote, requested)}");
            }
        }

        return new MergeRequestCreatedModel(number, $"#{number}", url, warnings);
    }

    public static IReadOnlyList<MergeRequestModel> Parse(string json, string host) => ForgeJson.ParseArray(json, host, Read);

    private static string Repository(ForgeRemoteModel remote) => $"repos/{remote.Project}";

    private static string PageQuery(int page) => $"per_page={ForgeJson.PageSize}&page={page.ToString(CultureInfo.InvariantCulture)}";

    private ForgeOutputModel Api(ForgeRemoteModel remote, string directory, string path, params string[] options) =>
        runner.Run(ForgeKind.GitHub, directory, ["api", "--hostname", remote.Host, path, .. options]);

    private ForgeOutputModel Send(ForgeRemoteModel remote, string directory, string path, string method, string body) =>
        runner.Run(ForgeKind.GitHub, directory, ["api", "--hostname", remote.Host, path, "--method", method, "--input", "-"], body);

    private static ForgeUserModel? Member(JsonElement user)
    {
        var member = ForgeJson.User(user, "login");
        return member.Login.Length > 0 ? member : null;
    }

    private static ForgeLabelModel? Label(JsonElement label)
    {
        var name = ForgeJson.Text(label, "name");
        var color = ForgeJson.Text(label, "color");
        return name.Length > 0 ? new ForgeLabelModel(name, color.Length > 0 ? $"#{color.TrimStart('#')}" : string.Empty, ForgeJson.Text(label, "description")) : null;
    }

    private static string StateArgument(MergeRequestStateFilter state) => state switch
    {
        MergeRequestStateFilter.Merged => "merged",
        MergeRequestStateFilter.Closed => "closed",
        MergeRequestStateFilter.All => "all",
        _ => "open"
    };

    private static MergeRequestModel Read(JsonElement item)
    {
        var number = ForgeJson.Number(item, "number");
        return new MergeRequestModel(
            number,
            $"#{number}",
            ForgeJson.Text(item, "title"),
            StateOf(ForgeJson.Text(item, "state")),
            ForgeJson.Flag(item, "isDraft"),
            ReviewOf(ForgeJson.Text(item, "reviewDecision")),
            item.TryGetProperty("author", out var author) ? ForgeJson.User(author, "login") : new ForgeUserModel(string.Empty, string.Empty),
            ForgeJson.Items(item, "assignees").Select(user => ForgeJson.User(user, "login")).ToList(),
            ForgeJson.Items(item, "reviewRequests").Select(Reviewer).Where(user => user.Login.Length > 0).ToList(),
            ForgeJson.Items(item, "labels").Select(label => ForgeJson.Text(label, "name")).Where(name => name.Length > 0).ToList(),
            ForgeJson.Text(item, "headRefName"),
            ForgeJson.Text(item, "baseRefName"),
            ForgeJson.Text(item, "url"),
            ForgeJson.Date(item, "createdAt"),
            ForgeJson.Date(item, "updatedAt"));
    }

    private static ForgeUserModel Reviewer(JsonElement request)
    {
        var user = ForgeJson.User(request, "login");
        if (user.Login.Length > 0)
        {
            return user;
        }

        var team = ForgeJson.Text(request, "slug");
        return new ForgeUserModel(team, ForgeJson.Text(request, "name") is { Length: > 0 } name ? name : team);
    }

    private static MergeRequestState StateOf(string state) => state switch
    {
        "MERGED" => MergeRequestState.Merged,
        "CLOSED" => MergeRequestState.Closed,
        _ => MergeRequestState.Open
    };

    private static MergeRequestReview ReviewOf(string decision) => decision switch
    {
        "APPROVED" => MergeRequestReview.Approved,
        "CHANGES_REQUESTED" => MergeRequestReview.ChangesRequested,
        "REVIEW_REQUIRED" => MergeRequestReview.ReviewRequired,
        _ => MergeRequestReview.None
    };
}

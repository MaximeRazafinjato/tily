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

    public static IReadOnlyList<MergeRequestModel> Parse(string json, string host) => ForgeJson.ParseArray(json, host, Read);

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

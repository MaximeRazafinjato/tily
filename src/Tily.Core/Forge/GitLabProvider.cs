using System.Globalization;
using System.Text.Json;

namespace Tily.Core.Forge;

public sealed class GitLabProvider(IForgeCommandRunner runner) : IForgeProvider
{
    public IReadOnlyList<MergeRequestModel> List(ForgeRemoteModel remote, string directory, MergeRequestQueryModel query)
    {
        var path = $"projects/{Uri.EscapeDataString(remote.Project)}/merge_requests?state={StateArgument(query.State)}&per_page={query.Limit.ToString(CultureInfo.InvariantCulture)}&order_by=updated_at&sort=desc";
        if (query.SourceBranch is { } branch)
        {
            path += $"&source_branch={Uri.EscapeDataString(branch)}";
        }

        var output = runner.Run(ForgeKind.GitLab, directory, ["api", path, "--hostname", remote.Host]);
        return output.Succeeded ? Parse(output.Output, remote.Host) : throw new ForgeException(ForgeErrors.Describe(remote, output));
    }

    public string? CurrentUser(ForgeRemoteModel remote, string directory)
    {
        var output = runner.Run(ForgeKind.GitLab, directory, ["api", "user", "--hostname", remote.Host]);
        if (!output.Succeeded)
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(output.Output);
            var login = ForgeJson.Text(document.RootElement, "username");
            return login.Length > 0 ? login : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public static IReadOnlyList<MergeRequestModel> Parse(string json, string host) => ForgeJson.ParseArray(json, host, Read);

    private static string StateArgument(MergeRequestStateFilter state) => state switch
    {
        MergeRequestStateFilter.Merged => "merged",
        MergeRequestStateFilter.Closed => "closed",
        MergeRequestStateFilter.All => "all",
        _ => "opened"
    };

    private static MergeRequestModel Read(JsonElement item)
    {
        var number = ForgeJson.Number(item, "iid");
        return new MergeRequestModel(
            number,
            $"!{number}",
            ForgeJson.Text(item, "title"),
            StateOf(ForgeJson.Text(item, "state")),
            ForgeJson.Flag(item, "draft") || ForgeJson.Flag(item, "work_in_progress"),
            ReviewOf(ForgeJson.Text(item, "detailed_merge_status")),
            item.TryGetProperty("author", out var author) ? ForgeJson.User(author, "username") : new ForgeUserModel(string.Empty, string.Empty),
            ForgeJson.Items(item, "assignees").Select(user => ForgeJson.User(user, "username")).ToList(),
            ForgeJson.Items(item, "reviewers").Select(user => ForgeJson.User(user, "username")).ToList(),
            ForgeJson.Items(item, "labels").Select(label => label.ValueKind == JsonValueKind.String ? label.GetString() ?? string.Empty : ForgeJson.Text(label, "name")).Where(name => name.Length > 0).ToList(),
            ForgeJson.Text(item, "source_branch"),
            ForgeJson.Text(item, "target_branch"),
            ForgeJson.Text(item, "web_url"),
            ForgeJson.Date(item, "created_at"),
            ForgeJson.Date(item, "updated_at"));
    }

    private static MergeRequestState StateOf(string state) => state switch
    {
        "merged" => MergeRequestState.Merged,
        "closed" => MergeRequestState.Closed,
        _ => MergeRequestState.Open
    };

    private static MergeRequestReview ReviewOf(string status) => status switch
    {
        "not_approved" => MergeRequestReview.ReviewRequired,
        "requested_changes" => MergeRequestReview.ChangesRequested,
        _ => MergeRequestReview.None
    };
}

using System.Globalization;
using System.Text.Json;

namespace Tily.Core.Forge;

public sealed class GitLabProvider(IForgeCommandRunner runner) : IForgeProvider
{
    private const string DraftPrefix = "Draft: ";
    private const string ActiveState = "active";

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

    public IReadOnlyList<ForgeUserModel> Members(ForgeRemoteModel remote, string directory) =>
        ForgeJson.ReadPages(remote, page => Api(remote, directory, $"{Project(remote)}/members/all?{PageQuery(page)}"), Member)
            .DistinctBy(user => user.Login, StringComparer.OrdinalIgnoreCase)
            .OrderBy(user => user.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();

    public IReadOnlyList<ForgeLabelModel> Labels(ForgeRemoteModel remote, string directory) =>
        ForgeJson.ReadPages(remote, page => Api(remote, directory, $"{Project(remote)}/labels?{PageQuery(page)}"), Label);

    public string? DefaultBranch(ForgeRemoteModel remote, string directory)
    {
        var output = Api(remote, directory, Project(remote));
        if (!output.Succeeded)
        {
            throw new ForgeException(ForgeErrors.Describe(remote, output));
        }

        var branch = ForgeJson.ReadObject(output.Output, remote.Host, root => ForgeJson.Text(root, "default_branch"));
        return branch.Length > 0 ? branch : null;
    }

    public MergeRequestCreatedModel Create(ForgeRemoteModel remote, string directory, MergeRequestInputModel input)
    {
        var warnings = new List<string>();
        var assignees = UserIds(remote, directory, input.Assignee is { } assignee ? [assignee] : [], warnings);
        var reviewers = UserIds(remote, directory, input.Reviewers, warnings);
        var request = new Dictionary<string, object>
        {
            ["source_branch"] = input.SourceBranch,
            ["target_branch"] = input.TargetBranch,
            ["title"] = input.Draft ? $"{DraftPrefix}{input.Title}" : input.Title,
            ["description"] = input.Description
        };
        if (assignees.Count > 0)
        {
            request["assignee_ids"] = assignees;
        }

        if (reviewers.Count > 0)
        {
            request["reviewer_ids"] = reviewers;
        }

        if (input.Labels.Count > 0)
        {
            request["labels"] = string.Join(',', input.Labels);
        }

        var output = runner.Run(ForgeKind.GitLab, directory, ["api", $"{Project(remote)}/merge_requests", "--method", "POST", "--input", "-", "--hostname", remote.Host], ForgeJson.Serialize(request));
        if (!output.Succeeded)
        {
            throw new ForgeException(ForgeErrors.DescribeRequest(remote, output));
        }

        var (number, url) = ForgeJson.ReadObject(output.Output, remote.Host, root => (ForgeJson.Number(root, "iid"), ForgeJson.Text(root, "web_url")));
        return number > 0 ? new MergeRequestCreatedModel(number, $"!{number}", url, warnings) : throw new ForgeException($"Réponse de {remote.Host} illisible.");
    }

    public static IReadOnlyList<MergeRequestModel> Parse(string json, string host) => ForgeJson.ParseArray(json, host, Read);

    private static string Project(ForgeRemoteModel remote) => $"projects/{Uri.EscapeDataString(remote.Project)}";

    private static string PageQuery(int page) => $"per_page={ForgeJson.PageSize}&page={page.ToString(CultureInfo.InvariantCulture)}";

    private ForgeOutputModel Api(ForgeRemoteModel remote, string directory, string path) =>
        runner.Run(ForgeKind.GitLab, directory, ["api", path, "--hostname", remote.Host]);

    private List<int> UserIds(ForgeRemoteModel remote, string directory, IReadOnlyList<string> logins, List<string> warnings)
    {
        var ids = new List<int>();
        foreach (var login in logins)
        {
            var output = Api(remote, directory, $"users?username={Uri.EscapeDataString(login)}");
            if (!output.Succeeded)
            {
                throw new ForgeException(ForgeErrors.Describe(remote, output));
            }

            var id = ForgeJson.ReadObject(output.Output, remote.Host, root =>
                root.ValueKind == JsonValueKind.Array ? root.EnumerateArray().Select(user => ForgeJson.Number(user, "id")).FirstOrDefault() : 0);
            if (id > 0)
            {
                ids.Add(id);
            }
            else
            {
                warnings.Add($"Utilisateur « {login} » introuvable sur {remote.Host} : ignoré.");
            }
        }

        return ids;
    }

    private static ForgeUserModel? Member(JsonElement member) =>
        ForgeJson.Text(member, "state") is ActiveState or "" && ForgeJson.User(member, "username") is { Login.Length: > 0 } user ? user : null;

    private static ForgeLabelModel? Label(JsonElement label)
    {
        var name = ForgeJson.Text(label, "name");
        return name.Length > 0 ? new ForgeLabelModel(name, ForgeJson.Text(label, "color"), ForgeJson.Text(label, "description")) : null;
    }

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

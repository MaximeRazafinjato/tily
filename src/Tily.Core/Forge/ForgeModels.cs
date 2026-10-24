using System.Text.Json.Serialization;

namespace Tily.Core.Forge;

[JsonConverter(typeof(JsonStringEnumConverter<ForgeKind>))]
public enum ForgeKind
{
    [JsonStringEnumMemberName("github")] GitHub,
    [JsonStringEnumMemberName("gitlab")] GitLab
}

[JsonConverter(typeof(JsonStringEnumConverter<MergeRequestState>))]
public enum MergeRequestState
{
    [JsonStringEnumMemberName("open")] Open,
    [JsonStringEnumMemberName("merged")] Merged,
    [JsonStringEnumMemberName("closed")] Closed
}

[JsonConverter(typeof(JsonStringEnumConverter<MergeRequestStateFilter>))]
public enum MergeRequestStateFilter
{
    [JsonStringEnumMemberName("open")] Open,
    [JsonStringEnumMemberName("merged")] Merged,
    [JsonStringEnumMemberName("closed")] Closed,
    [JsonStringEnumMemberName("all")] All
}

[JsonConverter(typeof(JsonStringEnumConverter<MergeRequestReview>))]
public enum MergeRequestReview
{
    [JsonStringEnumMemberName("none")] None,
    [JsonStringEnumMemberName("approved")] Approved,
    [JsonStringEnumMemberName("changesRequested")] ChangesRequested,
    [JsonStringEnumMemberName("reviewRequired")] ReviewRequired
}

public sealed record ForgeRemoteModel(ForgeKind Kind, string Host, string Project, string WebUrl);

public sealed record ForgeUserModel(string Login, string Name);

public sealed record MergeRequestModel(
    int Number,
    string Reference,
    string Title,
    MergeRequestState State,
    bool Draft,
    MergeRequestReview Review,
    ForgeUserModel Author,
    IReadOnlyList<ForgeUserModel> Assignees,
    IReadOnlyList<ForgeUserModel> Reviewers,
    IReadOnlyList<string> Labels,
    string SourceBranch,
    string TargetBranch,
    string Url,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record MergeRequestQueryModel(MergeRequestStateFilter State, int Limit, string? SourceBranch = null);

public sealed record MergeRequestListModel(ForgeRemoteModel Forge, IReadOnlyList<MergeRequestModel> Items, bool Truncated, string? CurrentUser);

public sealed record BranchMergeRequestsModel(ForgeRemoteModel? Forge, IReadOnlyList<MergeRequestModel> Items, string? Error);

public sealed record ForgeOutputModel(int ExitCode, string Output, string Error)
{
    public bool Succeeded => ExitCode == 0;
}

public sealed class ForgeException(string message) : Exception(message);

public static class MergeRequestStateFilters
{
    public static MergeRequestStateFilter Parse(string? value) => value switch
    {
        null or "" or "open" => MergeRequestStateFilter.Open,
        "merged" => MergeRequestStateFilter.Merged,
        "closed" => MergeRequestStateFilter.Closed,
        "all" => MergeRequestStateFilter.All,
        _ => throw new ForgeException($"État de MR/PR inconnu : {value}")
    };
}

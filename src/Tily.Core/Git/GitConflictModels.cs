using System.Text.Json.Serialization;

namespace Tily.Core.Git;

[JsonConverter(typeof(JsonStringEnumConverter<GitMergeChunkKind>))]
public enum GitMergeChunkKind
{
    [JsonStringEnumMemberName("common")] Common,
    [JsonStringEnumMemberName("ours")] Ours,
    [JsonStringEnumMemberName("theirs")] Theirs,
    [JsonStringEnumMemberName("both")] Both,
    [JsonStringEnumMemberName("conflict")] Conflict
}

[JsonConverter(typeof(JsonStringEnumConverter<GitConflictView>))]
public enum GitConflictView
{
    [JsonStringEnumMemberName("text")] Text,
    [JsonStringEnumMemberName("binary")] Binary,
    [JsonStringEnumMemberName("tooLarge")] TooLarge,
    [JsonStringEnumMemberName("presence")] Presence
}

[JsonConverter(typeof(JsonStringEnumConverter<GitConflictResolution>))]
public enum GitConflictResolution
{
    [JsonStringEnumMemberName("ours")] Ours,
    [JsonStringEnumMemberName("theirs")] Theirs,
    [JsonStringEnumMemberName("delete")] Delete
}

public sealed record GitMergeChunkModel(GitMergeChunkKind Kind, IReadOnlyList<string> Ours, IReadOnlyList<string> Theirs, IReadOnlyList<string>? Result);

public sealed record GitConflictSidesModel(string Ours, string? Theirs);

public sealed record GitConflictFileModel(
    string Path,
    GitConflictKind Kind,
    GitConflictView View,
    GitConflictSidesModel Sides,
    bool OursExists,
    bool TheirsExists,
    IReadOnlyList<GitMergeChunkModel> Chunks,
    bool FinalNewline,
    string? Language,
    string? Version);

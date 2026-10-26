using System.Text.Json.Serialization;
using Tily.Core.Worktrees;

namespace Tily.Core.Git;

[JsonConverter(typeof(JsonStringEnumConverter<GitChangeKind>))]
public enum GitChangeKind
{
    [JsonStringEnumMemberName("modified")] Modified,
    [JsonStringEnumMemberName("added")] Added,
    [JsonStringEnumMemberName("deleted")] Deleted,
    [JsonStringEnumMemberName("renamed")] Renamed,
    [JsonStringEnumMemberName("copied")] Copied,
    [JsonStringEnumMemberName("typeChanged")] TypeChanged,
    [JsonStringEnumMemberName("untracked")] Untracked
}

[JsonConverter(typeof(JsonStringEnumConverter<GitConflictKind>))]
public enum GitConflictKind
{
    [JsonStringEnumMemberName("bothModified")] BothModified,
    [JsonStringEnumMemberName("bothAdded")] BothAdded,
    [JsonStringEnumMemberName("bothDeleted")] BothDeleted,
    [JsonStringEnumMemberName("addedByUs")] AddedByUs,
    [JsonStringEnumMemberName("addedByThem")] AddedByThem,
    [JsonStringEnumMemberName("deletedByUs")] DeletedByUs,
    [JsonStringEnumMemberName("deletedByThem")] DeletedByThem
}

[JsonConverter(typeof(JsonStringEnumConverter<GitOperationKind>))]
public enum GitOperationKind
{
    [JsonStringEnumMemberName("merge")] Merge,
    [JsonStringEnumMemberName("rebase")] Rebase,
    [JsonStringEnumMemberName("cherryPick")] CherryPick,
    [JsonStringEnumMemberName("revert")] Revert
}

[JsonConverter(typeof(JsonStringEnumConverter<GitHistoryScope>))]
public enum GitHistoryScope
{
    [JsonStringEnumMemberName("all")] All,
    [JsonStringEnumMemberName("current")] Current
}

[JsonConverter(typeof(JsonStringEnumConverter<GitRefKind>))]
public enum GitRefKind
{
    [JsonStringEnumMemberName("head")] Head,
    [JsonStringEnumMemberName("branch")] Branch,
    [JsonStringEnumMemberName("remote")] Remote,
    [JsonStringEnumMemberName("tag")] Tag
}

public sealed record GitLocationModel(string Root, string GitDirectory, string CommonDirectory);

public sealed record GitFileChangeModel(string Path, string? OldPath, GitChangeKind Kind);

public sealed record GitConflictModel(string Path, GitConflictKind Kind);

public sealed record GitHeadModel(string? Branch, string? Sha, bool Detached, bool Unborn, string? Upstream, int Ahead, int Behind);

public sealed record GitStatusModel(
    GitHeadModel Head,
    IReadOnlyList<GitFileChangeModel> Staged,
    IReadOnlyList<GitFileChangeModel> Unstaged,
    IReadOnlyList<GitConflictModel> Conflicts,
    int StagedTotal,
    int UnstagedTotal);

public sealed record GitBranchModel(string Name, string Sha, string? Upstream, int Ahead, int Behind, bool Gone, bool Current, bool Merged);

public sealed record GitRemoteBranchModel(string Name, string Remote, string Branch, string Sha);

public sealed record GitTagModel(string Name, string Sha);

public sealed record GitStashModel(int Index, string Sha, string Message, string Base, string Author, string Email, long Date);

public sealed record GitRefsModel(
    IReadOnlyList<GitBranchModel> Branches,
    IReadOnlyList<GitRemoteBranchModel> RemoteBranches,
    IReadOnlyList<GitTagModel> Tags,
    IReadOnlyList<string> Remotes);

public sealed record GitUndoInfoModel(string Label, bool Available, string? Reason);

public sealed record GitStateModel(
    string Root,
    string Name,
    GitHeadModel Head,
    GitOperationKind? Operation,
    IReadOnlyList<GitFileChangeModel> Staged,
    IReadOnlyList<GitFileChangeModel> Unstaged,
    IReadOnlyList<GitConflictModel> Conflicts,
    int StagedTotal,
    int UnstagedTotal,
    IReadOnlyList<GitBranchModel> Branches,
    IReadOnlyList<GitRemoteBranchModel> RemoteBranches,
    IReadOnlyList<GitTagModel> Tags,
    IReadOnlyList<GitStashModel> Stashes,
    IReadOnlyList<string> Remotes,
    string? LastMessage,
    GitUndoInfoModel? Undo,
    bool ForcePushAllowed,
    IReadOnlyList<WorktreeModel> Worktrees);

public sealed record GitRefLabelModel(string Name, GitRefKind Kind, bool Current, IReadOnlyList<string> Remotes);

public sealed record GitCommitModel(
    string Sha,
    IReadOnlyList<string> Parents,
    string Author,
    string Email,
    long Date,
    string Subject,
    IReadOnlyList<GitRefLabelModel> Refs,
    GitGraphRowModel Graph,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Stash = false,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Pushable = false);

public sealed record GitHistoryModel(string Root, GitHistoryScope Scope, IReadOnlyList<GitCommitModel> Commits, bool HasMore, GitGraphRowModel WorkingTree);

public sealed record GitCommitDetailsModel(string Sha, IReadOnlyList<string> Parents, string Author, string Email, long Date, string Message, IReadOnlyList<GitFileChangeModel> Files);

public sealed record GitOutcomeModel(string Message, bool Warning = false, GitUndoRecordModel? Undo = null, bool ClearUndo = false, string? Output = null);

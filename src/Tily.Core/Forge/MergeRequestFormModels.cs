namespace Tily.Core.Forge;

public sealed record ForgeLabelModel(string Name, string Color, string Description);

public sealed record MergeRequestInputModel(
    string SourceBranch,
    string TargetBranch,
    string Title,
    string Description,
    IReadOnlyList<string> Reviewers,
    string? Assignee,
    IReadOnlyList<string> Labels,
    bool Draft);

public sealed record MergeRequestCreatedModel(int Number, string Reference, string Url, IReadOnlyList<string> Warnings);

public sealed record MergeRequestCommitModel(string Subject, string Body);

public sealed record BranchPublicationModel(bool Local, bool Published, int Ahead)
{
    public bool NeedsPush => Local && (!Published || Ahead > 0);
}

public sealed record MergeRequestBranchInfoModel(
    string Source,
    string Target,
    BranchPublicationModel Publication,
    int Commits,
    string Title,
    string Description,
    IReadOnlyList<MergeRequestModel> Existing,
    string? Error);

public sealed record MergeRequestFormDataModel(
    ForgeRemoteModel Forge,
    string Root,
    string? CurrentUser,
    IReadOnlyList<ForgeUserModel> Members,
    IReadOnlyList<ForgeLabelModel> Labels,
    IReadOnlyList<string> SourceBranches,
    IReadOnlyList<string> TargetBranches,
    string DefaultTarget,
    MergeRequestBranchInfoModel Branch,
    IReadOnlyList<string> Warnings);

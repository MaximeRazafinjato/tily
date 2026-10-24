namespace Tily.Core.Forge;

public interface IForgeProvider
{
    IReadOnlyList<MergeRequestModel> List(ForgeRemoteModel remote, string directory, MergeRequestQueryModel query);

    string? CurrentUser(ForgeRemoteModel remote, string directory);

    IReadOnlyList<ForgeUserModel> Members(ForgeRemoteModel remote, string directory);

    IReadOnlyList<ForgeLabelModel> Labels(ForgeRemoteModel remote, string directory);

    string? DefaultBranch(ForgeRemoteModel remote, string directory);

    MergeRequestCreatedModel Create(ForgeRemoteModel remote, string directory, MergeRequestInputModel input);
}

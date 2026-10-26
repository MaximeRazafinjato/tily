namespace Tily.Core.Forge;

public interface IForgeProvider
{
    IReadOnlyList<MergeRequestModel> List(ForgeRemoteModel remote, string directory, MergeRequestQueryModel query);

    string? CurrentUser(ForgeRemoteModel remote, string directory);

    IReadOnlyList<ForgeUserModel> Members(ForgeRemoteModel remote, string directory);

    IReadOnlyList<ForgeLabelModel> Labels(ForgeRemoteModel remote, string directory);

    string? DefaultBranch(ForgeRemoteModel remote, string directory);

    MergeRequestCreatedModel Create(ForgeRemoteModel remote, string directory, MergeRequestInputModel input);

    MergeRequestDetailModel Get(ForgeRemoteModel remote, string directory, int number);

    MergeRequestUpdatedModel Update(ForgeRemoteModel remote, string directory, MergeRequestChangesModel changes);
}

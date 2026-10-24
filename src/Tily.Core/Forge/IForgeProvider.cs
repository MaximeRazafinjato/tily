namespace Tily.Core.Forge;

public interface IForgeProvider
{
    IReadOnlyList<MergeRequestModel> List(ForgeRemoteModel remote, string directory, MergeRequestQueryModel query);

    string? CurrentUser(ForgeRemoteModel remote, string directory);
}

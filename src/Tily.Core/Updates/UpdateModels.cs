namespace Tily.Core.Updates;

public sealed record UpdateAssetModel(string Name, string Url, long Size, string Sha256);

public sealed record UpdateReleaseModel(string Version, string Name, IReadOnlyList<string> Notes, string PageUrl, DateTimeOffset? PublishedAt, UpdateAssetModel Installer)
{
    public bool IsNewerThan(string currentVersion) => ReleaseVersion.IsNewer(Version, currentVersion);
}

public sealed class UpdateException(string message) : Exception(message);

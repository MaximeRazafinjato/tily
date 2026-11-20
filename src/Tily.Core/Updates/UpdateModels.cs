namespace Tily.Core.Updates;

public sealed record UpdateAssetModel(string Name, string Url, long Size, string Sha256);

public sealed record ReleaseNoteModel(string? Title, string Text);

public sealed record ReleaseNoteSectionModel(string? Title, IReadOnlyList<ReleaseNoteModel> Notes);

public sealed record ReleaseHistoryModel(string Version, bool Prerelease, DateTimeOffset? PublishedAt, string PageUrl, IReadOnlyList<ReleaseNoteSectionModel> Sections);

public sealed record UpdateReleaseModel(string Version, string Name, IReadOnlyList<ReleaseNoteModel> Notes, string PageUrl, DateTimeOffset? PublishedAt, UpdateAssetModel Installer)
{
    public bool IsNewerThan(string currentVersion) => ReleaseVersion.IsNewer(Version, currentVersion);
}

public sealed class UpdateException(string message) : Exception(message);

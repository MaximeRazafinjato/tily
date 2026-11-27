namespace Tily.Core.Updates;

public static class ReleaseHistory
{
    public static IReadOnlyList<ReleaseHistoryModel> Since(IEnumerable<ReleaseHistoryModel> history, string currentVersion, string latestVersion) =>
        history
            .Where(entry => ReleaseVersion.IsNewer(entry.Version, currentVersion) && !ReleaseVersion.IsNewer(entry.Version, latestVersion))
            .OrderByDescending(entry => ReleaseVersion.Parse(entry.Version))
            .ToList();
}

namespace Tily.Core.Updates;

public static class UpdateSource
{
    public const string Repository = "MaximeRazafinjato/tily";
    public const string LatestReleaseUrl = "https://api.github.com/repos/" + Repository + "/releases/latest";
    public const string ReleasesUrl = "https://api.github.com/repos/" + Repository + "/releases?per_page=30";
    public const string ReleasesPage = "https://github.com/" + Repository + "/releases";
}

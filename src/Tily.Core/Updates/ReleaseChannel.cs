namespace Tily.Core.Updates;

public enum ReleaseChannel
{
    Stable,
    Beta
}

public static class ReleaseChannels
{
    private const string StableInstallerAppId = "{16F57C9A-8C6B-4E4B-8EA7-714760447F62}";
    private const string BetaInstallerAppId = "{60B8F3DD-A70C-4227-834B-F9F38445A016}";

#if TILY_BETA
    public const ReleaseChannel Current = ReleaseChannel.Beta;
#else
    public const ReleaseChannel Current = ReleaseChannel.Stable;
#endif

    public static string Identifier(ReleaseChannel channel) => channel == ReleaseChannel.Beta ? "beta" : "stable";

    public static string ApplicationName(ReleaseChannel channel) => channel == ReleaseChannel.Beta ? "Tily Beta" : "Tily";

    public static string ApplicationUserModelId(ReleaseChannel channel) => channel == ReleaseChannel.Beta ? "MaximeRazafinjato.Tily.Beta" : "MaximeRazafinjato.Tily";

    public static string UninstallKey(ReleaseChannel channel) =>
        $@"Software\Microsoft\Windows\CurrentVersion\Uninstall\{(channel == ReleaseChannel.Beta ? BetaInstallerAppId : StableInstallerAppId)}_is1";

    public static string InstallerName(ReleaseChannel channel, string version) => $"{(channel == ReleaseChannel.Beta ? "TilyBeta" : "Tily")}-{version}-setup.exe";
}

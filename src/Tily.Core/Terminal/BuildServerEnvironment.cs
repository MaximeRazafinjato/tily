namespace Tily.Core.Terminal;

public static class BuildServerEnvironment
{
    public static readonly IReadOnlyDictionary<string, string> Transient = new Dictionary<string, string>
    {
        ["MSBUILDDISABLENODEREUSE"] = "1",
        ["DOTNET_CLI_USE_MSBUILD_SERVER"] = "0",
        ["UseSharedCompilation"] = "false"
    };

    public static IReadOnlyDictionary<string, string> Of(bool transientBuildServers) => transientBuildServers ? Transient : new Dictionary<string, string>();
}

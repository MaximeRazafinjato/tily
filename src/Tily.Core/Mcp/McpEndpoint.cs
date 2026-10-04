using Tily.Core.Session;

namespace Tily.Core.Mcp;

public static class McpEndpoint
{
    public const string DataDirectoryVariable = "TILY_DATA_DIR";
    public const string PaneVariable = "TILY_PANE_ID";
    private const string PipePrefix = "tily-mcp-";

    public static string DataDirectory(string? overridden, string localApplicationData) =>
        string.IsNullOrWhiteSpace(overridden)
            ? Path.Combine(localApplicationData, "Tily")
            : Path.GetFullPath(overridden);

    public static string? Pane(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public static string? PaneFromEnvironment() => Pane(Environment.GetEnvironmentVariable(PaneVariable));

    public static string DataDirectoryFromEnvironment() =>
        DataDirectory(Environment.GetEnvironmentVariable(DataDirectoryVariable), Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData));

    public static string PipeName(string dataDirectory) => PipePrefix + DataDirectoryFingerprint.Of(dataDirectory);
}

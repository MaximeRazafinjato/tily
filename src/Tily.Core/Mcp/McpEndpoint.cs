using System.Text.RegularExpressions;
using Tily.Core.Session;

namespace Tily.Core.Mcp;

public static partial class McpEndpoint
{
    public const string DataDirectoryVariable = "TILY_DATA_DIR";
    public const string PaneVariable = "TILY_PANE_ID";
    public const string PipeVariable = "TILY_MCP_PIPE";
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

    public static string InstancePipeName(string dataDirectory, string sessionId) => $"{PipeName(dataDirectory)}-{sessionId}";

    public static string Pipe(string? announced, string dataDirectory) =>
        announced is not null && InstancePipe().IsMatch(announced.Trim()) ? announced.Trim() : PipeName(dataDirectory);

    public static string PipeFromEnvironment() => Pipe(Environment.GetEnvironmentVariable(PipeVariable), DataDirectoryFromEnvironment());

    [GeneratedRegex("^tily-mcp-[0-9a-f]{24}-[0-9a-f]{32}$")]
    private static partial Regex InstancePipe();
}

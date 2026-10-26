namespace Tily.Core.Terminal;

public sealed record TerminalSessionOptions
{
    public required string PaneId { get; init; }
    public required string CommandLine { get; init; }
    public string? WorkingDirectory { get; init; }
    public int Columns { get; init; } = 120;
    public int Rows { get; init; } = 30;
    public IReadOnlyDictionary<string, string> ExtraEnvironment { get; init; } = new Dictionary<string, string>();
}

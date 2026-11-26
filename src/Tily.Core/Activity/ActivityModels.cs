namespace Tily.Core.Activity;

public static class ProcessCategory
{
    public const string Claude = "claude";
    public const string Commands = "commands";
    public const string Mcp = "mcp";
    public const string Terminal = "terminal";
    public const string App = "app";
    public const string WebView = "webview";
    public const string Other = "other";
}

public sealed record ProcessEntryModel(int Id, int ParentId, string Name);

public sealed record ProcessCountersModel(TimeSpan CpuTime, long WorkingSetBytes);

public sealed record ProcessUsageModel(int Id, string Name, int Depth, string Category, double Cpu, double Ram);

public sealed record PaneUsageModel(string PaneId, IReadOnlyList<ProcessUsageModel> Processes);

public sealed record ActivityModel(IReadOnlyList<PaneUsageModel> Panes, IReadOnlyList<ProcessUsageModel> Host);

public interface IProcessProbe
{
    IReadOnlyList<ProcessEntryModel> Snapshot();

    ProcessCountersModel? Counters(int processId);
}

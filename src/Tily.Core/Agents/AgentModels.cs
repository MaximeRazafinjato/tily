using System.Text.Json.Serialization;

namespace Tily.Core.Agents;

[JsonConverter(typeof(JsonStringEnumConverter<AgentState>))]
public enum AgentState
{
    [JsonStringEnumMemberName("working")] Working,
    [JsonStringEnumMemberName("waiting")] Waiting,
    [JsonStringEnumMemberName("done")] Done,
    [JsonStringEnumMemberName("error")] Error,
    [JsonStringEnumMemberName("unknown")] Unknown
}

public sealed record PaneAgentModel(string PaneId, string Agent, AgentState State, string? Message, string? Detail = null)
{
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public bool Interrupted { get; init; }
}

public sealed record PaneProbeModel(string PaneId, DateTime StartedAtUtc, IReadOnlyList<string> Processes, IReadOnlyList<int>? ProcessIds = null);

public sealed class AgentStateFileModel
{
    public string? Agent { get; set; }
    public string? State { get; set; }
    public string? Message { get; set; }
    public string? Detail { get; set; }
}

public sealed record AgentStateModel(string Agent, AgentState State, string? Message, string? Detail = null)
{
    public DateTime UpdatedAtUtc { get; init; }
}

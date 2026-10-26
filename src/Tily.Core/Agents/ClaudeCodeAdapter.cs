namespace Tily.Core.Agents;

public sealed class ClaudeCodeAdapter : IAgentAdapter
{
    public const string InterruptedMessage = "Interrompu.";

    public static readonly TimeSpan InterruptionGrace = TimeSpan.FromSeconds(3);

    private readonly ClaudeSessionRegistry? _registry;
    private readonly Func<DateTime> _clock;

    public ClaudeCodeAdapter(ClaudeSessionRegistry? registry = null, Func<DateTime>? clock = null)
    {
        _registry = registry;
        _clock = clock ?? (() => DateTime.UtcNow);
    }

    public string Id => "claude";

    public PaneAgentModel? Detect(PaneProbeModel probe, AgentStateModel? reported)
    {
        var session = _registry?.Find(probe.ProcessIds ?? []);
        return reported is not null && reported.Agent == Id
            ? Reconcile(new PaneAgentModel(probe.PaneId, Id, reported.State, reported.Message, reported.Detail), reported, session)
            : session is not null || probe.Processes.Contains(Id, StringComparer.OrdinalIgnoreCase)
                ? new PaneAgentModel(probe.PaneId, Id, AgentState.Unknown, null)
                : null;
    }

    private PaneAgentModel Reconcile(PaneAgentModel agent, AgentStateModel reported, ClaudeSessionModel? session)
    {
        var interrupted = reported.State is AgentState.Working or AgentState.Waiting
            && session is { Status: ClaudeSessionStatus.Idle, StatusUpdatedAtUtc: { } idleSince }
            && idleSince > reported.UpdatedAtUtc
            && _clock() - idleSince >= InterruptionGrace;
        return interrupted
            ? agent with { State = AgentState.Done, Message = InterruptedMessage, Detail = null, Interrupted = true }
            : agent;
    }
}

namespace Tily.Core.Agents;

public sealed class AgentMonitor
{
    private readonly AgentStateRepository _states;
    private readonly IReadOnlyList<IAgentAdapter> _adapters;

    public AgentMonitor(AgentStateRepository states, ClaudeSessionRegistry? registry = null)
    {
        _states = states;
        _adapters = [new ClaudeCodeAdapter(registry)];
    }

    public IReadOnlyList<PaneAgentModel> Resolve(IEnumerable<PaneProbeModel> probes)
    {
        var agents = new List<PaneAgentModel>();
        foreach (var probe in probes)
        {
            if (probe.Processes.Count == 0)
            {
                _states.Delete(probe.PaneId);
                continue;
            }

            var reported = _states.Read(probe.PaneId, probe.StartedAtUtc);
            var detected = _adapters.Select(adapter => adapter.Detect(probe, reported)).FirstOrDefault(agent => agent is not null);
            if (detected is not null)
            {
                agents.Add(detected);
            }
        }

        return agents;
    }
}

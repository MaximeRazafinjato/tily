using Tily.Core.Agents;
using Xunit;

namespace Tily.Core.Tests.Agents;

public sealed class AgentMonitorTests : IDisposable
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), "tily-tests-" + Guid.NewGuid().ToString("N"));
    private readonly AgentStateRepository _states;
    private readonly AgentMonitor _monitor;

    public AgentMonitorTests()
    {
        _states = new AgentStateRepository(_directory);
        Directory.CreateDirectory(_states.Directory);
        _monitor = new AgentMonitor(_states);
    }

    [Fact]
    public void Resolve_WhenClaudeReportsWaiting_ThenExposesStateAndMessage()
    {
        var started = DateTime.UtcNow.AddMinutes(-1);
        File.WriteAllText(_states.FilePathFor("pane-a"), "{ \"agent\": \"claude\", \"state\": \"waiting\", \"message\": \"Autorisation requise\" }");

        var agents = _monitor.Resolve([new PaneProbeModel("pane-a", started, ["node"])]);

        Assert.Equal(new PaneAgentModel("pane-a", "claude", AgentState.Waiting, "Autorisation requise"), agents.Single());
    }

    [Fact]
    public void Resolve_WhenClaudeReportsMultilineDetail_ThenDetailIsSingleLine()
    {
        var started = DateTime.UtcNow.AddMinutes(-1);
        File.WriteAllText(_states.FilePathFor("pane-a"), "{ \"agent\": \"claude\", \"state\": \"waiting\", \"message\": \"Autorisation demandée : Bash\", \"detail\": \"git add .\\n  git push   --force\" }");

        var agents = _monitor.Resolve([new PaneProbeModel("pane-a", started, ["node"])]);

        Assert.Equal(new PaneAgentModel("pane-a", "claude", AgentState.Waiting, "Autorisation demandée : Bash", "git add . git push --force"), agents.Single());
    }

    [Fact]
    public void Resolve_WhenClaudeReportsMultilineQuestion_ThenMessageIsSingleLine()
    {
        var started = DateTime.UtcNow.AddMinutes(-1);
        File.WriteAllText(_states.FilePathFor("pane-a"), "{ \"agent\": \"claude\", \"state\": \"waiting\", \"message\": \"Quelle base ?\\n  Choisir   une option\" }");

        var message = _monitor.Resolve([new PaneProbeModel("pane-a", started, ["node"])]).Single().Message;

        Assert.Equal("Quelle base ? Choisir une option", message);
    }

    [Fact]
    public void Resolve_WhenDetailTooLong_ThenDetailIsTruncatedWithEllipsis()
    {
        var started = DateTime.UtcNow.AddMinutes(-1);
        File.WriteAllText(_states.FilePathFor("pane-a"), $"{{ \"agent\": \"claude\", \"state\": \"waiting\", \"detail\": \"{new string('x', 500)}\" }}");

        var detail = _monitor.Resolve([new PaneProbeModel("pane-a", started, ["node"])]).Single().Detail;

        Assert.Equal(new string('x', AgentStateRepository.MaxDetailLength - 1) + "…", detail);
    }

    [Fact]
    public void Resolve_WhenOnlyProcessPresent_ThenStateIsUnknown()
    {
        var agents = _monitor.Resolve([
            new PaneProbeModel("pane-claude", DateTime.UtcNow, ["claude"]),
            new PaneProbeModel("pane-ping", DateTime.UtcNow, ["ping"])
        ]);

        Assert.Equal([new PaneAgentModel("pane-claude", "claude", AgentState.Unknown, null)], agents);
    }

    [Fact]
    public void Resolve_WhenStateOlderThanSession_ThenIgnored()
    {
        File.WriteAllText(_states.FilePathFor("pane-old"), "{ \"agent\": \"claude\", \"state\": \"waiting\" }");

        var agents = _monitor.Resolve([new PaneProbeModel("pane-old", DateTime.UtcNow.AddMinutes(1), ["node"])]);

        Assert.Empty(agents);
    }

    [Fact]
    public void Resolve_WhenNoProcessLeft_ThenDeletesStaleState()
    {
        var path = _states.FilePathFor("pane-idle");
        File.WriteAllText(path, "{ \"agent\": \"claude\", \"state\": \"done\" }");

        var agents = _monitor.Resolve([new PaneProbeModel("pane-idle", DateTime.UtcNow.AddMinutes(-1), [])]);

        Assert.Empty(agents);
        Assert.False(File.Exists(path));
    }

    [Fact]
    public void Resolve_WhenStateFileInvalid_ThenFallsBackToProcess()
    {
        File.WriteAllText(_states.FilePathFor("pane-bad"), "{ \"agent\": \"claude\", \"state\": \"dancing\" }");

        var agents = _monitor.Resolve([new PaneProbeModel("pane-bad", DateTime.UtcNow.AddMinutes(-1), ["claude"])]);

        Assert.Equal(AgentState.Unknown, agents.Single().State);
    }

    [Fact]
    public void Resolve_WhenRegistryIdleAfterWorkingState_ThenAgentIsInterrupted()
    {
        var claudeDirectory = Path.Combine(_directory, "claude");
        Directory.CreateDirectory(Path.Combine(claudeDirectory, "sessions"));
        var statePath = _states.FilePathFor("pane-a");
        File.WriteAllText(statePath, "{ \"agent\": \"claude\", \"state\": \"working\" }");
        File.SetLastWriteTimeUtc(statePath, DateTime.UtcNow.AddSeconds(-30));
        var idleSince = DateTimeOffset.UtcNow.AddSeconds(-10).ToUnixTimeMilliseconds();
        File.WriteAllText(Path.Combine(claudeDirectory, "sessions", "4242.json"), $"{{ \"pid\": 4242, \"sessionId\": \"3f2c8a51-6d0e-4b7a-9c1f-2e5d7a9b0c14\", \"status\": \"idle\", \"statusUpdatedAt\": {idleSince} }}");
        var monitor = new AgentMonitor(_states, new ClaudeSessionRegistry(claudeDirectory, _ => null));

        var agent = monitor.Resolve([new PaneProbeModel("pane-a", DateTime.UtcNow.AddMinutes(-1), ["claude"], [4242])]).Single();

        Assert.Equal((AgentState.Done, true), (agent.State, agent.Interrupted));
    }

    [Fact]
    public void Clear_WhenFilesExist_ThenRemovesThemAll()
    {
        File.WriteAllText(_states.FilePathFor("pane-1"), "{}");
        File.WriteAllText(_states.FilePathFor("pane-2"), "{}");

        _states.Clear();

        Assert.Empty(Directory.GetFiles(_states.Directory));
    }

    [Fact]
    public void Serialize_WhenPaneAgent_ThenStateIsCamelCase()
    {
        var json = System.Text.Json.JsonSerializer.Serialize(new PaneAgentModel("pane", "claude", AgentState.Waiting, null), Tily.Core.Session.SessionRepository.JsonOptions);

        Assert.Contains("\"state\": \"waiting\"", json);
    }

    public void Dispose()
    {
        if (Directory.Exists(_directory))
        {
            Directory.Delete(_directory, true);
        }
    }
}

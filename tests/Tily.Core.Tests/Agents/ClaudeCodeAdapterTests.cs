using System.Globalization;
using System.Text.Json;
using Tily.Core.Agents;
using Xunit;

namespace Tily.Core.Tests.Agents;

public sealed class ClaudeCodeAdapterTests : IDisposable
{
    private const int ProcessId = 4242;
    private const string SessionId = "3f2c8a51-6d0e-4b7a-9c1f-2e5d7a9b0c14";

    private static readonly DateTime ProcessStart = new(2026, 9, 30, 20, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime HookWrittenAt = ProcessStart.AddMinutes(10);

    private readonly string _directory = Path.Combine(Path.GetTempPath(), "tily-tests-" + Guid.NewGuid().ToString("N"));
    private readonly ClaudeCodeAdapter _adapter;

    public ClaudeCodeAdapterTests()
    {
        Directory.CreateDirectory(Path.Combine(_directory, "sessions"));
        _adapter = new ClaudeCodeAdapter(new ClaudeSessionRegistry(_directory, processId => processId == ProcessId ? ProcessStart : null));
    }

    [Theory]
    [InlineData(AgentState.Working)]
    [InlineData(AgentState.Waiting)]
    public void Detect_WhenRegistryIdleAfterHookState_ThenAgentIsInterrupted(AgentState reportedState)
    {
        WriteRegistry("idle", HookWrittenAt.AddSeconds(5));

        var agent = _adapter.Detect(Probe(), Reported(reportedState));

        Assert.Equal(
            new PaneAgentModel("pane-a", "claude", AgentState.Done, ClaudeCodeAdapter.InterruptedMessage) { Interrupted = true },
            agent);
    }

    [Fact]
    public void Detect_WhenRegistryIdleForLessThanGrace_ThenHookStateKept()
    {
        WriteRegistry("idle", HookWrittenAt.AddSeconds(5));
        var adapter = new ClaudeCodeAdapter(new ClaudeSessionRegistry(_directory, processId => processId == ProcessId ? ProcessStart : null), clock: () => HookWrittenAt.AddSeconds(6));

        var state = adapter.Detect(Probe(), Reported(AgentState.Working))?.State;

        Assert.Equal(AgentState.Working, state);
    }

    [Fact]
    public void Detect_WhenRegistryIdleBeforeHookState_ThenHookStateKept()
    {
        WriteRegistry("idle", HookWrittenAt.AddSeconds(-5));

        var state = _adapter.Detect(Probe(), Reported(AgentState.Working))?.State;

        Assert.Equal(AgentState.Working, state);
    }

    [Fact]
    public void Detect_WhenRegistryBusy_ThenHookStateKept()
    {
        WriteRegistry("busy", HookWrittenAt.AddSeconds(5));

        var state = _adapter.Detect(Probe(), Reported(AgentState.Waiting))?.State;

        Assert.Equal(AgentState.Waiting, state);
    }

    [Fact]
    public void Detect_WhenHookReportsDone_ThenNotMarkedInterrupted()
    {
        WriteRegistry("idle", HookWrittenAt.AddSeconds(5));

        var agent = _adapter.Detect(Probe(), Reported(AgentState.Done));

        Assert.False(agent?.Interrupted);
    }

    [Fact]
    public void Detect_WhenRegistryMissing_ThenHookStateUnchanged()
    {
        var agent = _adapter.Detect(Probe(), Reported(AgentState.Working));

        Assert.Equal(new PaneAgentModel("pane-a", "claude", AgentState.Working, "En cours", "détail"), agent);
    }

    [Fact]
    public void Detect_WhenRegistryUnreadable_ThenHookStateUnchanged()
    {
        File.WriteAllText(RegistryPath(), "{ \"status\": \"idle\", ");

        var agent = _adapter.Detect(Probe(), Reported(AgentState.Waiting));

        Assert.Equal(new PaneAgentModel("pane-a", "claude", AgentState.Waiting, "En cours", "détail"), agent);
    }

    [Fact]
    public void Detect_WhenOnlyRegistryPresent_ThenStateIsUnknown()
    {
        WriteRegistry("busy", HookWrittenAt);

        var agent = _adapter.Detect(Probe(), null);

        Assert.Equal(new PaneAgentModel("pane-a", "claude", AgentState.Unknown, null), agent);
    }

    private static PaneProbeModel Probe() => new("pane-a", ProcessStart, ["node"], [ProcessId]);

    private static AgentStateModel Reported(AgentState state) => new("claude", state, "En cours", "détail") { UpdatedAtUtc = HookWrittenAt };

    private string RegistryPath() => Path.Combine(_directory, "sessions", ProcessId.ToString(CultureInfo.InvariantCulture) + ".json");

    private void WriteRegistry(string status, DateTime statusUpdatedAt) =>
        File.WriteAllText(RegistryPath(), JsonSerializer.Serialize(new
        {
            pid = ProcessId,
            sessionId = SessionId,
            cwd = @"C:\repo\app",
            procStart = ProcessStart.ToFileTimeUtc().ToString(CultureInfo.InvariantCulture),
            status,
            statusUpdatedAt = new DateTimeOffset(statusUpdatedAt).ToUnixTimeMilliseconds()
        }));

    public void Dispose()
    {
        if (Directory.Exists(_directory))
        {
            Directory.Delete(_directory, true);
        }
    }
}

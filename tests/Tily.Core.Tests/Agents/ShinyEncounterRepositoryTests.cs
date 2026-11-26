using Tily.Core.Agents;
using Xunit;

namespace Tily.Core.Tests.Agents;

public sealed class ShinyEncounterRepositoryTests : IDisposable
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), "tily-tests-" + Guid.NewGuid().ToString("N"));

    public ShinyEncounterRepositoryTests()
    {
        Directory.CreateDirectory(_directory);
    }

    [Fact]
    public void Record_WhenShinyAgentFirstSeen_ThenEncounterCounted()
    {
        var repository = new ShinyEncounterRepository(_directory);

        var encounters = repository.Record([Agent("pane-a", "session-142", shiny: true)]);

        Assert.Equal([new ShinyEncounterModel("pane-a", null, 1)], encounters);
    }

    [Fact]
    public void Record_WhenSameSessionSeenAfterRestart_ThenNotCountedTwice()
    {
        new ShinyEncounterRepository(_directory).Record([Agent("pane-a", "session-142", shiny: true)]);
        var restarted = new ShinyEncounterRepository(_directory);

        var encounters = restarted.Record([Agent("pane-b", "session-142", shiny: true)]);

        Assert.Equal((0, 1), (encounters.Count, restarted.Count));
    }

    [Fact]
    public void Record_WhenAgentNotShiny_ThenNothingWritten()
    {
        var repository = new ShinyEncounterRepository(_directory);

        var encounters = repository.Record([Agent("pane-a", "session-0", shiny: false)]);

        Assert.Equal((0, false), (encounters.Count, File.Exists(repository.FilePath)));
    }

    [Fact]
    public void Record_WhenShinySubagent_ThenEncounterNamesSubagent()
    {
        var repository = new ShinyEncounterRepository(_directory);
        var agent = Agent("pane-a", "session-0", shiny: false) with { Subagents = [new SubagentModel("agent-259", "Explore") { Shiny = true }, new SubagentModel("agent-0", "Plan")] };

        var encounters = repository.Record([agent]);

        Assert.Equal([new ShinyEncounterModel("pane-a", "agent-259", 1)], encounters);
    }

    [Fact]
    public void Record_WhenMoreThanRemembered_ThenCountKeepsGrowing()
    {
        var repository = new ShinyEncounterRepository(_directory);
        var agents = Enumerable.Range(0, ShinyEncounterRepository.MaxRemembered + 5).Select(index => Agent("pane-a", $"session-{index}", shiny: true)).ToList();

        repository.Record(agents);

        Assert.Equal(ShinyEncounterRepository.MaxRemembered + 5, new ShinyEncounterRepository(_directory).Count);
    }

    [Fact]
    public void Load_WhenFileUnreadable_ThenQuarantinedAndCountStartsAtZero()
    {
        File.WriteAllText(Path.Combine(_directory, "shiny.json"), "{ pas du json");

        var repository = new ShinyEncounterRepository(_directory);

        Assert.Equal((0, 1), (repository.Count, Directory.GetFiles(_directory, "shiny.corrompu-*.json").Length));
    }

    private static PaneAgentModel Agent(string paneId, string sessionId, bool shiny) =>
        new(paneId, "claude", AgentState.Working, null) { SessionId = sessionId, Shiny = shiny };

    public void Dispose()
    {
        if (Directory.Exists(_directory))
        {
            Directory.Delete(_directory, true);
        }
    }
}

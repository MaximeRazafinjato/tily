using System.Text.Json;
using Tily.Core.Session;

namespace Tily.Core.Agents;

public sealed class ShinyEncounterRepository
{
    public const int MaxRemembered = 1000;

    private readonly object _sync = new();
    private readonly List<string> _remembered = [];
    private readonly HashSet<string> _seen = new(StringComparer.Ordinal);
    private readonly bool _writable;
    private int _count;

    public ShinyEncounterRepository(string dataDirectory)
    {
        FilePath = Path.Combine(dataDirectory, "shiny.json");
        _writable = Load();
    }

    public string FilePath { get; }

    public int Count
    {
        get
        {
            lock (_sync)
            {
                return _count;
            }
        }
    }

    public IReadOnlyList<ShinyEncounterModel> Record(IEnumerable<PaneAgentModel> agents)
    {
        lock (_sync)
        {
            var encounters = agents.SelectMany(EncountersOf).ToList();
            if (encounters.Count > 0)
            {
                Save();
            }

            return encounters;
        }
    }

    private IEnumerable<ShinyEncounterModel> EncountersOf(PaneAgentModel agent)
    {
        if (agent.Shiny && Remember(agent.SessionId))
        {
            yield return new ShinyEncounterModel(agent.PaneId, null, _count);
        }

        foreach (var subagent in agent.Subagents ?? [])
        {
            if (subagent.Shiny && Remember(subagent.Id))
            {
                yield return new ShinyEncounterModel(agent.PaneId, subagent.Id, _count);
            }
        }
    }

    private bool Remember(string? id)
    {
        if (string.IsNullOrWhiteSpace(id) || !_seen.Add(id))
        {
            return false;
        }

        _remembered.Add(id);
        if (_remembered.Count > MaxRemembered)
        {
            _seen.Remove(_remembered[0]);
            _remembered.RemoveAt(0);
        }

        _count++;
        return true;
    }

    private bool Load()
    {
        if (!File.Exists(FilePath))
        {
            return true;
        }

        try
        {
            var file = JsonSerializer.Deserialize<ShinyEncountersFileModel>(File.ReadAllText(FilePath), SessionRepository.JsonOptions);
            foreach (var id in (file?.Seen ?? []).Where(id => !string.IsNullOrWhiteSpace(id)).Distinct(StringComparer.Ordinal).TakeLast(MaxRemembered))
            {
                _seen.Add(id);
                _remembered.Add(id);
            }

            _count = Math.Max(file?.Count ?? 0, _remembered.Count);
            return true;
        }
        catch (JsonException)
        {
            return Quarantine();
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            return false;
        }
    }

    private bool Quarantine()
    {
        try
        {
            CorruptedFiles.Quarantine(FilePath);
            return true;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            return false;
        }
    }

    private void Save()
    {
        if (!_writable)
        {
            return;
        }

        try
        {
            AtomicFile.Write(FilePath, JsonSerializer.Serialize(new ShinyEncountersFileModel { Count = _count, Seen = [.. _remembered] }, SessionRepository.JsonOptions));
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
        }
    }
}

public sealed class ShinyEncountersFileModel
{
    public int Count { get; set; }
    public List<string>? Seen { get; set; }
}

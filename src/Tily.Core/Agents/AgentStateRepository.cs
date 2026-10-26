using System.Text.Json;
using Tily.Core.Session;

namespace Tily.Core.Agents;

public sealed class AgentStateRepository
{
    public const int MaxDetailLength = 240;

    private static readonly Dictionary<string, AgentState> States = new(StringComparer.OrdinalIgnoreCase)
    {
        ["working"] = AgentState.Working,
        ["waiting"] = AgentState.Waiting,
        ["done"] = AgentState.Done,
        ["error"] = AgentState.Error,
        ["unknown"] = AgentState.Unknown
    };

    public AgentStateRepository(string dataDirectory)
    {
        Directory = Path.Combine(dataDirectory, "agents");
    }

    public string Directory { get; }

    public string FilePathFor(string paneId) => Path.Combine(Directory, paneId + ".json");

    public AgentStateModel? Read(string paneId, DateTime notBeforeUtc)
    {
        var path = FilePathFor(paneId);
        var writtenAtUtc = File.Exists(path) ? File.GetLastWriteTimeUtc(path) : DateTime.MinValue;
        if (writtenAtUtc == DateTime.MinValue || writtenAtUtc < notBeforeUtc)
        {
            return null;
        }

        AgentStateFileModel? file;
        try
        {
            file = JsonSerializer.Deserialize<AgentStateFileModel>(File.ReadAllText(path), SessionRepository.JsonOptions);
        }
        catch (Exception exception) when (exception is JsonException or IOException or UnauthorizedAccessException)
        {
            return null;
        }

        if (file?.Agent is null || file.State is null || !States.TryGetValue(file.State, out var state))
        {
            return null;
        }

        return new AgentStateModel(file.Agent.Trim().ToLowerInvariant(), state, SingleLine(file.Message), SingleLine(file.Detail)) { UpdatedAtUtc = writtenAtUtc };
    }

    private static string? SingleLine(string? detail)
    {
        if (string.IsNullOrWhiteSpace(detail))
        {
            return null;
        }

        var line = string.Join(' ', detail.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        return line.Length <= MaxDetailLength ? line : line[..(MaxDetailLength - 1)].TrimEnd() + "…";
    }

    public void Delete(string paneId)
    {
        try
        {
            File.Delete(FilePathFor(paneId));
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
        }
    }

    public void Clear()
    {
        if (!System.IO.Directory.Exists(Directory))
        {
            return;
        }

        foreach (var path in System.IO.Directory.EnumerateFiles(Directory, "*.json"))
        {
            try
            {
                File.Delete(path);
            }
            catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
            {
            }
        }
    }
}

using System.Text.Json;
using Tily.Core.Session;

namespace Tily.Core.Agents;

public sealed class AgentStateRepository
{
    public const int MaxDetailLength = 240;
    private const string SubagentInfix = ".sub.";
    private const string StoppedExtension = ".stopped";

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

        return new AgentStateModel(file.Agent.Trim().ToLowerInvariant(), state, SingleLine(file.Message), SingleLine(file.Detail))
        {
            UpdatedAtUtc = writtenAtUtc,
            Tool = SingleLine(file.Tool),
            Subagents = ReadSubagents(paneId, notBeforeUtc)
        };
    }

    public string SubagentFilePathFor(string paneId, string agentId) => Path.Combine(Directory, $"{paneId}{SubagentInfix}{agentId}.json");

    private IReadOnlyList<SubagentModel>? ReadSubagents(string paneId, DateTime notBeforeUtc)
    {
        var prefix = paneId + SubagentInfix;
        var subagents = SubagentFiles(paneId, "*.json")
            .Select(path => new FileInfo(path))
            .Where(file => file.LastWriteTimeUtc >= notBeforeUtc && !File.Exists(Path.ChangeExtension(file.FullName, StoppedExtension)))
            .OrderBy(file => file.CreationTimeUtc)
            .ThenBy(file => file.Name, StringComparer.Ordinal)
            .Select(file => ReadSubagent(file, file.Name[prefix.Length..^".json".Length]))
            .OfType<SubagentModel>()
            .ToList();
        return subagents.Count > 0 ? subagents : null;
    }

    private static SubagentModel? ReadSubagent(FileInfo file, string agentId)
    {
        try
        {
            var model = JsonSerializer.Deserialize<SubagentFileModel>(File.ReadAllText(file.FullName), SessionRepository.JsonOptions);
            return string.IsNullOrWhiteSpace(model?.Type) ? null : new SubagentModel(agentId, model.Type.Trim(), SingleLine(model.Tool));
        }
        catch (Exception exception) when (exception is JsonException or IOException or UnauthorizedAccessException)
        {
            return null;
        }
    }

    private IEnumerable<string> SubagentFiles(string paneId, string pattern = "*") =>
        System.IO.Directory.Exists(Directory) ? System.IO.Directory.EnumerateFiles(Directory, $"{paneId}{SubagentInfix}{pattern}") : [];

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
        foreach (var path in SubagentFiles(paneId).Prepend(FilePathFor(paneId)).ToList())
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

    public void Clear()
    {
        if (!System.IO.Directory.Exists(Directory))
        {
            return;
        }

        foreach (var path in System.IO.Directory.EnumerateFiles(Directory, "*.json").Concat(System.IO.Directory.EnumerateFiles(Directory, "*" + StoppedExtension)).ToList())
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

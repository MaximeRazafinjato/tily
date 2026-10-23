using System.Text.Json;
using System.Text.Json.Nodes;
using Tily.Core.Session;

namespace Tily.Core.Mcp;

public sealed record ClaudeMcpStatusModel(string ConfigFile, bool Installed, string? Command);

public sealed class ClaudeMcpInstaller
{
    public const string ServerName = "tily";
    public const string ExecutableName = "tily-mcp.exe";
    private const string ServersKey = "mcpServers";
    private static readonly JsonDocumentOptions ReadOptions = new() { CommentHandling = JsonCommentHandling.Skip, AllowTrailingCommas = true };
    private static readonly JsonSerializerOptions WriteOptions = new() { WriteIndented = true, Encoder = SessionRepository.JsonOptions.Encoder };

    public ClaudeMcpInstaller(string executablePath, string? configFile = null)
    {
        ExecutablePath = executablePath;
        ConfigFile = configFile ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".claude.json");
    }

    public string ExecutablePath { get; }

    public string ConfigFile { get; }

    public ClaudeMcpStatusModel Status()
    {
        var entry = EntryOf(Read());
        return entry is not null && IsTilyEntry(entry)
            ? new ClaudeMcpStatusModel(ConfigFile, true, TextOf(entry["command"]))
            : new ClaudeMcpStatusModel(ConfigFile, false, null);
    }

    public ClaudeMcpStatusModel Install()
    {
        var root = Read();
        var entry = EntryOf(root);
        if (entry is not null && !IsTilyEntry(entry))
        {
            throw new InvalidOperationException($"Un serveur MCP « {ServerName} » qui n’est pas celui de Tily existe déjà dans {ConfigFile} : retirez-le ou renommez-le d’abord.");
        }

        var servers = root[ServersKey] as JsonObject ?? new JsonObject();
        root[ServersKey] = servers;
        servers[ServerName] = new JsonObject
        {
            ["type"] = "stdio",
            ["command"] = ExecutablePath,
            ["args"] = new JsonArray(),
            ["env"] = new JsonObject()
        };
        Write(root);
        return new ClaudeMcpStatusModel(ConfigFile, true, ExecutablePath);
    }

    public ClaudeMcpStatusModel Remove()
    {
        RemoveIfPresent();
        return new ClaudeMcpStatusModel(ConfigFile, false, null);
    }

    public bool RemoveIfPresent()
    {
        var root = Read();
        var entry = EntryOf(root);
        if (entry is null || !IsTilyEntry(entry))
        {
            return false;
        }

        ((JsonObject)root[ServersKey]!).Remove(ServerName);
        Write(root);
        return true;
    }

    public bool RepointIfMissing()
    {
        var entry = EntryOf(Read());
        if (entry is null || !IsTilyEntry(entry) || File.Exists(TextOf(entry["command"])) || !File.Exists(ExecutablePath))
        {
            return false;
        }

        Install();
        return true;
    }

    private static JsonObject? EntryOf(JsonObject root) =>
        (root[ServersKey] as JsonObject)?[ServerName] as JsonObject;

    private static bool IsTilyEntry(JsonObject entry) =>
        TextOf(entry["command"]) is { } command && Path.GetFileName(command).Equals(ExecutableName, StringComparison.OrdinalIgnoreCase);

    private static string? TextOf(JsonNode? node) =>
        node is JsonValue value && value.TryGetValue<string>(out var text) ? text : null;

    private JsonObject Read()
    {
        if (!File.Exists(ConfigFile))
        {
            return new JsonObject();
        }

        try
        {
            return JsonNode.Parse(File.ReadAllText(ConfigFile), null, ReadOptions) as JsonObject
                ?? throw new InvalidOperationException($"Le fichier {ConfigFile} ne contient pas un objet JSON.");
        }
        catch (JsonException exception)
        {
            throw new InvalidOperationException($"Le fichier {ConfigFile} est illisible : {exception.Message}");
        }
    }

    private void Write(JsonObject root)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(ConfigFile)!);
        AtomicFile.Write(ConfigFile, root.ToJsonString(WriteOptions));
    }
}

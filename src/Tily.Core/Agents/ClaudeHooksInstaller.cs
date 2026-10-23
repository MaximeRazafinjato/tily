using System.Text.Json;
using System.Text.Json.Nodes;
using Tily.Core.Session;

namespace Tily.Core.Agents;

public sealed record ClaudeHooksStatusModel(string SettingsFile, bool Installed);

public sealed record ClaudeHookGroupModel(string? Matcher, string? Condition);

public sealed class ClaudeHooksInstaller
{
    public static readonly IReadOnlyList<string> Events = ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "PermissionRequest", "Notification", "Stop", "StopFailure", "SessionEnd"];
    public const string PreviewCommandCondition = "Bash(start *)";
    private static readonly ClaudeHookGroupModel[] DefaultGroups = [new(null, null)];
    private static readonly Dictionary<string, ClaudeHookGroupModel[]> Groups = new()
    {
        ["PreToolUse"] = [new("AskUserQuestion", null), new("Bash", PreviewCommandCondition)]
    };
    private const int HookTimeoutSeconds = 5;
    private const string ScriptName = "tily-agent-state.ps1";
    private static readonly JsonDocumentOptions ReadOptions = new() { CommentHandling = JsonCommentHandling.Skip, AllowTrailingCommas = true };
    private static readonly JsonSerializerOptions WriteOptions = new() { WriteIndented = true, Encoder = SessionRepository.JsonOptions.Encoder };

    private readonly string _scriptPath;

    public ClaudeHooksInstaller(string scriptPath, string? settingsFile = null)
    {
        _scriptPath = scriptPath;
        SettingsFile = settingsFile ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".claude", "settings.json");
    }

    public string SettingsFile { get; }

    public ClaudeHooksStatusModel Status()
    {
        var root = Read();
        var hooks = root["hooks"] as JsonObject;
        var installed = hooks is not null && Events.All(eventName => GroupsFor(eventName).All(expected => GroupsOf(hooks, eventName).Any(group => IsTilyGroup(group) && Matches(group, expected))));
        return new ClaudeHooksStatusModel(SettingsFile, installed);
    }

    public ClaudeHooksStatusModel Install()
    {
        var root = Read();
        var hooks = root["hooks"] as JsonObject ?? new JsonObject();
        root["hooks"] = hooks;
        foreach (var eventName in Events)
        {
            var groups = hooks[eventName] as JsonArray ?? new JsonArray();
            hooks[eventName] = groups;
            foreach (var group in groups.OfType<JsonObject>().Where(IsTilyGroup).ToList())
            {
                groups.Remove(group);
            }

            foreach (var expected in GroupsFor(eventName))
            {
                groups.Add(TilyGroup(expected));
            }
        }

        Write(root);
        return new ClaudeHooksStatusModel(SettingsFile, true);
    }

    public bool RemoveIfPresent()
    {
        var root = Read();
        var present = root["hooks"] is JsonObject hooks && hooks.Select(pair => pair.Key).ToList().Any(eventName => GroupsOf(hooks, eventName).Any(IsTilyGroup));
        if (present)
        {
            Remove();
        }

        return present;
    }

    public bool RepointIfMissing()
    {
        var scripts = Read()["hooks"] is JsonObject hooks
            ? hooks.SelectMany(pair => GroupsOf(hooks, pair.Key)).SelectMany(ScriptsOf).ToList()
            : [];
        if (!File.Exists(_scriptPath) || scripts.All(File.Exists))
        {
            return false;
        }

        Install();
        return true;
    }

    public ClaudeHooksStatusModel Remove()
    {
        var root = Read();
        if (root["hooks"] is JsonObject hooks)
        {
            foreach (var eventName in hooks.Select(pair => pair.Key).ToList())
            {
                var groups = hooks[eventName] as JsonArray;
                if (groups is null)
                {
                    continue;
                }

                foreach (var group in groups.OfType<JsonObject>().Where(IsTilyGroup).ToList())
                {
                    groups.Remove(group);
                }

                if (groups.Count == 0)
                {
                    hooks.Remove(eventName);
                }
            }

            if (hooks.Count == 0)
            {
                root.Remove("hooks");
            }

            Write(root);
        }

        return new ClaudeHooksStatusModel(SettingsFile, false);
    }

    private static ClaudeHookGroupModel[] GroupsFor(string eventName) =>
        Groups.GetValueOrDefault(eventName) ?? DefaultGroups;

    private JsonObject TilyGroup(ClaudeHookGroupModel expected)
    {
        var group = new JsonObject();
        if (expected.Matcher is not null)
        {
            group["matcher"] = expected.Matcher;
        }

        var hook = new JsonObject
        {
            ["type"] = "command",
            ["command"] = "powershell.exe",
            ["args"] = new JsonArray("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", _scriptPath),
            ["timeout"] = HookTimeoutSeconds
        };
        if (expected.Condition is not null)
        {
            hook["if"] = expected.Condition;
        }

        group["hooks"] = new JsonArray(hook);
        return group;
    }

    private static bool Matches(JsonObject group, ClaudeHookGroupModel expected) =>
        TextOf(group["matcher"]) == expected.Matcher
        && (group["hooks"] as JsonArray)?.OfType<JsonObject>().Any(hook => IsTilyHook(hook) && TextOf(hook["if"]) == expected.Condition) == true;

    private static string? TextOf(JsonNode? node) =>
        node is JsonValue value && value.TryGetValue<string>(out var text) ? text : null;

    private static IEnumerable<JsonObject> GroupsOf(JsonObject hooks, string eventName) =>
        (hooks[eventName] as JsonArray)?.OfType<JsonObject>() ?? [];

    private static bool IsTilyGroup(JsonObject group) =>
        (group["hooks"] as JsonArray)?.OfType<JsonObject>().Any(IsTilyHook) == true;

    private static IEnumerable<string> ScriptsOf(JsonObject group) =>
        (group["hooks"] as JsonArray)?.OfType<JsonObject>().SelectMany(hook => (hook["args"] as JsonArray)?.Select(TextOf).OfType<string>() ?? []).Where(IsScript) ?? [];

    private static bool IsTilyHook(JsonObject hook) =>
        (hook["args"] as JsonArray)?.Any(argument => argument?.GetValueKind() == JsonValueKind.String && IsScript(argument.GetValue<string>())) == true;

    private static bool IsScript(string argument) => argument.EndsWith(ScriptName, StringComparison.OrdinalIgnoreCase);

    private JsonObject Read()
    {
        if (!File.Exists(SettingsFile))
        {
            return new JsonObject();
        }

        try
        {
            return JsonNode.Parse(File.ReadAllText(SettingsFile), null, ReadOptions) as JsonObject
                ?? throw new InvalidOperationException($"Le fichier {SettingsFile} ne contient pas un objet JSON.");
        }
        catch (JsonException exception)
        {
            throw new InvalidOperationException($"Le fichier {SettingsFile} est illisible : {exception.Message}");
        }
    }

    private void Write(JsonObject root)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(SettingsFile)!);
        AtomicFile.Write(SettingsFile, root.ToJsonString(WriteOptions));
    }
}

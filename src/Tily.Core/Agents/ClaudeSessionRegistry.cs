using System.ComponentModel;
using System.Diagnostics;
using System.Globalization;
using System.Text.Json;

namespace Tily.Core.Agents;

public sealed class ClaudeSessionRegistry
{
    private const double MaxUnixMilliseconds = 253402300799999;

    private static readonly TimeSpan StartTolerance = TimeSpan.FromSeconds(1);

    private static readonly Dictionary<string, ClaudeSessionStatus> Statuses = new(StringComparer.OrdinalIgnoreCase)
    {
        ["busy"] = ClaudeSessionStatus.Busy,
        ["shell"] = ClaudeSessionStatus.Shell,
        ["idle"] = ClaudeSessionStatus.Idle,
        ["waiting"] = ClaudeSessionStatus.Waiting
    };

    private readonly Func<int, DateTime?> _processStart;

    public ClaudeSessionRegistry(string claudeDirectory, Func<int, DateTime?>? processStart = null)
    {
        ClaudeDirectory = claudeDirectory;
        _processStart = processStart ?? ProcessStartOf;
    }

    public string ClaudeDirectory { get; }

    public string SessionsDirectory => Path.Combine(ClaudeDirectory, "sessions");

    public static string DefaultDirectory()
    {
        var configured = Environment.GetEnvironmentVariable("CLAUDE_CONFIG_DIR");
        return string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".claude")
            : configured;
    }

    public ClaudeSessionModel? Find(IEnumerable<int> processIds) =>
        processIds.Select(Read).FirstOrDefault(session => session is not null);

    public ClaudeSessionModel? Read(int processId)
    {
        var path = Path.Combine(SessionsDirectory, processId.ToString(CultureInfo.InvariantCulture) + ".json");
        if (!File.Exists(path))
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(File.ReadAllText(path));
            return Parse(processId, document.RootElement);
        }
        catch (Exception exception) when (exception is JsonException or IOException or UnauthorizedAccessException)
        {
            return null;
        }
    }

    private ClaudeSessionModel? Parse(int processId, JsonElement root)
    {
        if (root.ValueKind != JsonValueKind.Object || StringOf(root, "sessionId") is null || !SameProcess(processId, root))
        {
            return null;
        }

        var status = StringOf(root, "status") is { } text && Statuses.TryGetValue(text, out var known) ? known : ClaudeSessionStatus.Unknown;
        return new ClaudeSessionModel(processId, status, TimeOf(root, "statusUpdatedAt") ?? TimeOf(root, "updatedAt"));
    }

    private bool SameProcess(int processId, JsonElement root)
    {
        if (root.TryGetProperty("pid", out var pid) && (pid.ValueKind != JsonValueKind.Number || !pid.TryGetInt32(out var recorded) || recorded != processId))
        {
            return false;
        }

        if (!root.TryGetProperty("procStart", out var element))
        {
            return true;
        }

        var text = element.ValueKind switch
        {
            JsonValueKind.String => element.GetString(),
            JsonValueKind.Number => element.GetRawText(),
            _ => null
        };
        if (!long.TryParse(text, NumberStyles.None, CultureInfo.InvariantCulture, out var fileTime) || fileTime <= 0 || fileTime > DateTime.MaxValue.ToFileTimeUtc())
        {
            return true;
        }

        var started = _processStart(processId);
        return started is null || (DateTime.FromFileTimeUtc(fileTime) - started.Value).Duration() <= StartTolerance;
    }

    private static string? StringOf(JsonElement root, string name) =>
        root.TryGetProperty(name, out var element) && element.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(element.GetString())
            ? element.GetString()
            : null;

    private static DateTime? TimeOf(JsonElement root, string name) =>
        root.TryGetProperty(name, out var element) && element.ValueKind == JsonValueKind.Number && element.TryGetDouble(out var milliseconds) && milliseconds is >= 0 and <= MaxUnixMilliseconds
            ? DateTime.UnixEpoch.AddMilliseconds(milliseconds)
            : null;

    private static DateTime? ProcessStartOf(int processId)
    {
        try
        {
            using var process = Process.GetProcessById(processId);
            return process.StartTime.ToUniversalTime();
        }
        catch (Exception exception) when (exception is ArgumentException or InvalidOperationException or Win32Exception or NotSupportedException)
        {
            return null;
        }
    }
}

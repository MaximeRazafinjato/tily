using System.Globalization;
using System.Text.Json;
using Tily.Core.Agents;
using Xunit;

namespace Tily.Core.Tests.Agents;

public sealed class ClaudeSessionRegistryTests : IDisposable
{
    private const int ProcessId = 4242;
    private const string SessionId = "3f2c8a51-6d0e-4b7a-9c1f-2e5d7a9b0c14";

    private static readonly DateTime ProcessStart = new(2026, 9, 30, 20, 0, 0, DateTimeKind.Utc);

    private readonly string _directory = Path.Combine(Path.GetTempPath(), "tily-tests-" + Guid.NewGuid().ToString("N"));
    private readonly ClaudeSessionRegistry _registry;

    public ClaudeSessionRegistryTests()
    {
        Directory.CreateDirectory(Path.Combine(_directory, "sessions"));
        _registry = new ClaudeSessionRegistry(_directory, processId => processId == ProcessId ? ProcessStart : null);
    }

    [Fact]
    public void Read_WhenRegistryValid_ThenReturnsSession()
    {
        var updated = new DateTime(2026, 9, 30, 20, 5, 0, DateTimeKind.Utc);
        WriteRegistry(new { pid = ProcessId, sessionId = SessionId, cwd = @"C:\repo\app", procStart = FileTimeOf(ProcessStart), status = "waiting", waitingFor = "permission", statusUpdatedAt = UnixMillisecondsOf(updated) });

        var session = _registry.Read(ProcessId);

        Assert.Equal(new ClaudeSessionModel(ProcessId, ClaudeSessionStatus.Waiting, updated), session);
    }

    [Fact]
    public void Read_WhenPidDiffers_ThenIgnored()
    {
        WriteRegistry(new { pid = ProcessId + 1, sessionId = SessionId, status = "idle" });

        var session = _registry.Read(ProcessId);

        Assert.Null(session);
    }

    [Fact]
    public void Read_WhenProcessStartDiffers_ThenStaleRegistryIgnored()
    {
        WriteRegistry(new { pid = ProcessId, sessionId = SessionId, procStart = FileTimeOf(ProcessStart.AddHours(-3)), status = "idle" });

        var session = _registry.Read(ProcessId);

        Assert.Null(session);
    }

    [Fact]
    public void Read_WhenStatusUnrecognized_ThenStatusIsUnknown()
    {
        WriteRegistry(new { pid = ProcessId, sessionId = SessionId, status = "napping" });

        var status = _registry.Read(ProcessId)?.Status;

        Assert.Equal(ClaudeSessionStatus.Unknown, status);
    }

    [Fact]
    public void Read_WhenJsonUnreadable_ThenIgnored()
    {
        File.WriteAllText(RegistryPath(), "{ \"pid\": 4242, \"sessionId\": ");

        var session = _registry.Read(ProcessId);

        Assert.Null(session);
    }

    [Fact]
    public void Read_WhenSessionIdMissing_ThenIgnored()
    {
        WriteRegistry(new { pid = ProcessId, status = "busy" });

        var session = _registry.Read(ProcessId);

        Assert.Null(session);
    }

    [Fact]
    public void Find_WhenSeveralProcesses_ThenReturnsTheOneWithRegistry()
    {
        WriteRegistry(new { pid = ProcessId, sessionId = SessionId, status = "busy" });

        var session = _registry.Find([1111, ProcessId]);

        Assert.Equal(ProcessId, session?.ProcessId);
    }

    private string RegistryPath() => Path.Combine(_directory, "sessions", ProcessId.ToString(CultureInfo.InvariantCulture) + ".json");

    private void WriteRegistry(object registry) => File.WriteAllText(RegistryPath(), JsonSerializer.Serialize(registry));

    private static string FileTimeOf(DateTime time) => time.ToFileTimeUtc().ToString(CultureInfo.InvariantCulture);

    private static long UnixMillisecondsOf(DateTime time) => new DateTimeOffset(time).ToUnixTimeMilliseconds();

    public void Dispose()
    {
        if (Directory.Exists(_directory))
        {
            Directory.Delete(_directory, true);
        }
    }
}

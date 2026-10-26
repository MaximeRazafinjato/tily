namespace Tily.Core.Agents;

public enum ClaudeSessionStatus
{
    Unknown,
    Busy,
    Shell,
    Idle,
    Waiting
}

public sealed record ClaudeSessionModel(int ProcessId, ClaudeSessionStatus Status, DateTime? StatusUpdatedAtUtc);

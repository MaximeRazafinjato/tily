using System.Text.Json.Serialization;

namespace Tily.Core.Browser;

[JsonConverter(typeof(JsonStringEnumConverter<BrowserLogLevel>))]
public enum BrowserLogLevel
{
    [JsonStringEnumMemberName("debug")] Debug,
    [JsonStringEnumMemberName("log")] Log,
    [JsonStringEnumMemberName("warn")] Warn,
    [JsonStringEnumMemberName("error")] Error
}

public sealed record BrowserConsoleEntryModel(long Sequence, DateTimeOffset At, BrowserLogLevel Level, string Text, string? Url, int? Line, int Load);

public sealed record BrowserNetworkEntryModel(
    long Sequence,
    DateTimeOffset At,
    string Method,
    string Url,
    string? Type,
    int? Status,
    string? StatusText,
    string? MimeType,
    double? DurationMs,
    bool Failed,
    string? Error,
    string? Body,
    int Load)
{
    [JsonIgnore]
    public bool IsError => Failed || Status >= 400;
}

public sealed record BrowserEntriesModel<T>(IReadOnlyList<T> Entries, int Matching, int Load);

public sealed record BrowserConsoleMessageModel(BrowserLogLevel Level, string Text, string? Url, int? Line);

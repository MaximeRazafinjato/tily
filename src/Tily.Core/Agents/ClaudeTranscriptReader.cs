using System.Text;
using System.Text.Json;

namespace Tily.Core.Agents;

public sealed class ClaudeTranscriptReader
{
    public const int TailBytes = 512 * 1024;

    private readonly Dictionary<string, (long Length, DateTime WrittenAtUtc, int? Tokens)> _cache = new(StringComparer.OrdinalIgnoreCase);

    public int? ContextTokens(string? path)
    {
        if (string.IsNullOrWhiteSpace(path) || !path.EndsWith(".jsonl", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        try
        {
            var file = new FileInfo(path);
            if (!file.Exists)
            {
                return null;
            }

            if (_cache.TryGetValue(file.FullName, out var cached) && cached.Length == file.Length && cached.WrittenAtUtc == file.LastWriteTimeUtc)
            {
                return cached.Tokens;
            }

            var tokens = LastMainContext(ReadTail(file));
            _cache[file.FullName] = (file.Length, file.LastWriteTimeUtc, tokens);
            return tokens;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            return null;
        }
    }

    private static string ReadTail(FileInfo file)
    {
        using var stream = new FileStream(file.FullName, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        var length = (int)Math.Min(stream.Length, TailBytes);
        stream.Seek(-length, SeekOrigin.End);
        var buffer = new byte[length];
        stream.ReadExactly(buffer);
        return Encoding.UTF8.GetString(buffer);
    }

    private static int? LastMainContext(string tail)
    {
        foreach (var line in tail.Split('\n').Reverse())
        {
            if (!line.Contains("\"usage\"", StringComparison.Ordinal) || !line.Contains("\"assistant\"", StringComparison.Ordinal))
            {
                continue;
            }

            var tokens = ContextOf(line);
            if (tokens is not null)
            {
                return tokens;
            }
        }

        return null;
    }

    private static int? ContextOf(string line)
    {
        try
        {
            using var document = JsonDocument.Parse(line);
            var root = document.RootElement;
            if (!root.TryGetProperty("type", out var type) || type.GetString() != "assistant"
                || (root.TryGetProperty("isSidechain", out var sidechain) && sidechain.ValueKind == JsonValueKind.True)
                || !root.TryGetProperty("message", out var message) || !message.TryGetProperty("usage", out var usage))
            {
                return null;
            }

            return new[] { "input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens" }
                .Sum(name => usage.TryGetProperty(name, out var value) && value.TryGetInt32(out var count) ? count : 0);
        }
        catch (JsonException)
        {
            return null;
        }
    }
}

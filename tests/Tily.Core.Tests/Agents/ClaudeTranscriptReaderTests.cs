using Tily.Core.Agents;
using Xunit;

namespace Tily.Core.Tests.Agents;

public sealed class ClaudeTranscriptReaderTests : IDisposable
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), "tily-tests-" + Guid.NewGuid().ToString("N"));
    private readonly ClaudeTranscriptReader _reader = new();

    [Fact]
    public void ContextTokens_WhenSidechainAnswersLast_ThenSumsLastMainUsage()
    {
        var path = Transcript(
            "{\"type\":\"assistant\",\"isSidechain\":false,\"message\":{\"usage\":{\"input_tokens\":2,\"cache_creation_input_tokens\":1000,\"cache_read_input_tokens\":120000,\"output_tokens\":50}}}",
            "{\"type\":\"user\",\"message\":{\"content\":\"suite\"}}",
            "{\"type\":\"assistant\",\"isSidechain\":true,\"message\":{\"usage\":{\"input_tokens\":5,\"cache_read_input_tokens\":9000}}}");

        var tokens = _reader.ContextTokens(path);

        Assert.Equal(121002, tokens);
    }

    [Fact]
    public void ContextTokens_WhenFileGrows_ThenReadsNewUsage()
    {
        var path = Transcript("{\"type\":\"assistant\",\"message\":{\"usage\":{\"input_tokens\":10}}}");
        _reader.ContextTokens(path);
        File.AppendAllText(path, "{\"type\":\"assistant\",\"message\":{\"usage\":{\"input_tokens\":20}}}\n");

        var tokens = _reader.ContextTokens(path);

        Assert.Equal(20, tokens);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("C:\\absent\\session.jsonl")]
    [InlineData("C:\\Windows\\win.ini")]
    public void ContextTokens_WhenPathUnusable_ThenNull(string? path)
    {
        var tokens = _reader.ContextTokens(path);

        Assert.Null(tokens);
    }

    private string Transcript(params string[] lines)
    {
        Directory.CreateDirectory(_directory);
        var path = Path.Combine(_directory, "session.jsonl");
        File.WriteAllLines(path, lines);
        return path;
    }

    public void Dispose()
    {
        if (Directory.Exists(_directory))
        {
            Directory.Delete(_directory, true);
        }
    }
}

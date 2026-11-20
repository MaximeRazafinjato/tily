using Tily.Core.Git;
using Xunit;

namespace Tily.Core.Tests.Git;

public sealed class GitProgressReaderTests
{
    [Fact]
    public async Task ReadAsync_WhenProgressOverwritesLine_ThenReportsEachStep()
    {
        var reported = new List<string>();

        await GitProgressReader.ReadAsync(new StringReader("Cloning into 'x'...\nReceiving: 1%\rReceiving: 50%\rReceiving: 100%, done.\n"), reported.Add);

        Assert.Equal(["Cloning into 'x'...", "Receiving: 1%", "Receiving: 50%", "Receiving: 100%, done."], reported);
    }

    [Fact]
    public async Task ReadAsync_WhenProgressOverwritesLine_ThenKeepsOnlyFinalLines()
    {
        var text = await GitProgressReader.ReadAsync(new StringReader("Cloning into 'x'...\nReceiving: 1%\rReceiving: 100%, done.\nfatal: échec\r\nfin"), _ => { });

        Assert.Equal("Cloning into 'x'...\nReceiving: 100%, done.\nfatal: échec\nfin", text);
    }
}

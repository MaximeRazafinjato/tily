using Tily.Core.Mcp;
using Xunit;

namespace Tily.Core.Tests.Mcp;

public sealed class McpEndpointTests
{
    [Fact]
    public void PipeName_WhenSameFolderWrittenDifferently_ThenSameName()
    {
        var name = McpEndpoint.PipeName(@"C:\Users\Moi\AppData\Local\Tily");

        var variant = McpEndpoint.PipeName(@"c:\users\moi\appdata\local\tily\");

        Assert.Equal(name, variant);
    }

    [Fact]
    public void PipeName_WhenFoldersDiffer_ThenNamesDiffer()
    {
        var installed = McpEndpoint.PipeName(@"C:\Users\Moi\AppData\Local\Tily");

        var isolated = McpEndpoint.PipeName(@"C:\Temp\tily-dev");

        Assert.NotEqual(installed, isolated);
    }

    [Fact]
    public void PipeName_WhenComputed_ThenPrefixedAndBounded()
    {
        var name = McpEndpoint.PipeName(@"C:\Temp\tily-dev");

        Assert.Matches("^tily-mcp-[0-9a-f]{24}$", name);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Pane_WhenVariableMissingOrBlank_ThenOutsideTily(string? value)
    {
        var pane = McpEndpoint.Pane(value);

        Assert.Null(pane);
    }

    [Fact]
    public void Pane_WhenVariableSet_ThenTrimmedPaneId()
    {
        var pane = McpEndpoint.Pane(" 95724b0bb3834147a87a2b03e9aefbd0 ");

        Assert.Equal("95724b0bb3834147a87a2b03e9aefbd0", pane);
    }

    [Fact]
    public void DataDirectory_WhenNotOverridden_ThenTilyUnderLocalAppData()
    {
        var directory = McpEndpoint.DataDirectory(" ", @"C:\Users\Moi\AppData\Local");

        Assert.Equal(@"C:\Users\Moi\AppData\Local\Tily", directory);
    }

    [Fact]
    public void DataDirectory_WhenOverridden_ThenFullPathOfOverride()
    {
        var directory = McpEndpoint.DataDirectory(@"C:\Temp\..\Temp\tily-dev", @"C:\Users\Moi\AppData\Local");

        Assert.Equal(@"C:\Temp\tily-dev", directory);
    }

    [Fact]
    public void InstancePipeName_WhenTwoWindowsShareTheDataFolder_ThenNamesDiffer()
    {
        var first = McpEndpoint.InstancePipeName(@"C:\Temp\tily-dev", "2900f708077a49ca9ce94df5c379068d");

        var second = McpEndpoint.InstancePipeName(@"C:\Temp\tily-dev", "431949d1ff21481680f58fb4fbcdc05c");

        Assert.NotEqual(first, second);
        Assert.StartsWith(McpEndpoint.PipeName(@"C:\Temp\tily-dev") + "-", first);
    }

    [Fact]
    public void Pipe_WhenTheWindowAnnouncedItsPipe_ThenUsesIt()
    {
        var announced = McpEndpoint.InstancePipeName(@"C:\Temp\tily-dev", "2900f708077a49ca9ce94df5c379068d");

        var pipe = McpEndpoint.Pipe($" {announced} ", @"C:\Autre\Tily");

        Assert.Equal(announced, pipe);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(@"\\.\pipe\autre")]
    [InlineData("tily-mcp-tropcourt")]
    public void Pipe_WhenNothingValidAnnounced_ThenFallsBackToTheDataFolderPipe(string? announced)
    {
        var pipe = McpEndpoint.Pipe(announced, @"C:\Temp\tily-dev");

        Assert.Equal(McpEndpoint.PipeName(@"C:\Temp\tily-dev"), pipe);
    }
}

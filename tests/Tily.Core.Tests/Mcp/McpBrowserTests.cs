using Tily.Core.Mcp;
using Xunit;

namespace Tily.Core.Tests.Mcp;

public sealed class McpBrowserTests : IDisposable
{
    private readonly string _folder = Directory.CreateTempSubdirectory("tily-capture-é ").FullName;

    [Theory]
    [InlineData(McpBrowser.Open, true)]
    [InlineData(McpBrowser.Navigate, true)]
    [InlineData(McpBrowser.Screenshot, true)]
    [InlineData(McpBrowser.Console, false)]
    [InlineData(McpBrowser.Network, false)]
    public void IsLong_WhenTool_ThenOnlyNavigationAndCapture(string tool, bool expected)
    {
        var isLong = McpBrowser.IsLong(tool);

        Assert.Equal(expected, isLong);
    }

    [Theory]
    [InlineData(0, 1)]
    [InlineData(50, 50)]
    [InlineData(10_000, McpBrowser.MaxLimit)]
    public void Limit_WhenRequested_ThenBounded(int requested, int expected)
    {
        var limit = McpBrowser.Limit(requested);

        Assert.Equal(expected, limit);
    }

    [Fact]
    public void Url_WhenHostWithPort_ThenNormalized()
    {
        var url = McpBrowser.Url("localhost:5173/equipe");

        Assert.Equal("http://localhost:5173/equipe", url);
    }

    [Theory]
    [InlineData(null, "right")]
    [InlineData(" Down ", "down")]
    [InlineData("tab", "tab")]
    public void Placement_WhenKnownOrMissing_ThenValue(string? placement, string expected)
    {
        var value = McpBrowser.Placement(placement);

        Assert.Equal(expected, value);
    }

    [Fact]
    public void Placement_WhenUnknown_ThenFailsInFrench()
    {
        var error = Assert.Throws<InvalidOperationException>(() => McpBrowser.Placement("left"));

        Assert.StartsWith("Emplacement inconnu", error.Message);
    }

    [Theory]
    [InlineData(null, "log")]
    [InlineData("ERROR", "error")]
    public void Level_WhenKnownOrMissing_ThenValue(string? level, string expected)
    {
        var value = McpBrowser.Level(level);

        Assert.Equal(expected, value);
    }

    [Fact]
    public void Level_WhenUnknown_ThenFailsInFrench()
    {
        var error = Assert.Throws<InvalidOperationException>(() => McpBrowser.Level("info"));

        Assert.StartsWith("Niveau inconnu", error.Message);
    }

    [Theory]
    [InlineData(null, null)]
    [InlineData("Mobile", "mobile")]
    public void Viewport_WhenMissingOrKnown_ThenNullOrName(string? viewport, string? expected)
    {
        var value = McpBrowser.Viewport(viewport);

        Assert.Equal(expected, value);
    }

    [Fact]
    public void ScreenshotPath_WhenRelative_ThenUnderCurrentDirectory()
    {
        var path = McpBrowser.ScreenshotPath("avant.png", _folder);

        Assert.Equal(Path.Combine(_folder, "avant.png"), path);
    }

    [Fact]
    public void ScreenshotPath_WhenNotPng_ThenFails()
    {
        var error = Assert.Throws<InvalidOperationException>(() => McpBrowser.ScreenshotPath("avant.jpg", _folder));

        Assert.StartsWith("La capture s’enregistre en PNG", error.Message);
    }

    [Fact]
    public void ScreenshotPath_WhenFolderMissing_ThenFails()
    {
        var error = Assert.Throws<InvalidOperationException>(() => McpBrowser.ScreenshotPath(Path.Combine("absent", "avant.png"), _folder));

        Assert.StartsWith("Dossier introuvable pour la capture", error.Message);
    }

    [Fact]
    public void ScreenshotPath_WhenBlank_ThenNull()
    {
        var path = McpBrowser.ScreenshotPath(" ", _folder);

        Assert.Null(path);
    }

    public void Dispose() => Directory.Delete(_folder, true);
}

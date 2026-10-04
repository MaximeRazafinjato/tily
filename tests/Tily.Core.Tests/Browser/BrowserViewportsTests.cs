using Tily.Core.Browser;
using Xunit;

namespace Tily.Core.Tests.Browser;

public sealed class BrowserViewportsTests
{
    [Theory]
    [InlineData(null, BrowserViewport.Desktop)]
    [InlineData("", BrowserViewport.Desktop)]
    [InlineData("desktop", BrowserViewport.Desktop)]
    [InlineData(" Mobile ", BrowserViewport.Mobile)]
    public void Parse_WhenKnownOrMissing_ThenViewport(string? value, BrowserViewport expected)
    {
        var viewport = BrowserViewports.Parse(value);

        Assert.Equal(expected, viewport);
    }

    [Fact]
    public void Parse_WhenUnknown_ThenFailsInFrench()
    {
        var error = Assert.Throws<InvalidOperationException>(() => BrowserViewports.Parse("tablette"));

        Assert.Equal("Largeur inconnue : « tablette ». Choisissez desktop ou mobile.", error.Message);
    }

    [Theory]
    [InlineData(BrowserViewport.Desktop, 1440, 900, 1, false)]
    [InlineData(BrowserViewport.Mobile, 390, 844, 2, true)]
    public void Capture_WhenViewport_ThenPresetSize(BrowserViewport viewport, int width, int height, double scale, bool mobile)
    {
        var size = BrowserViewports.Capture(viewport);

        Assert.Equal(new BrowserViewportSizeModel(width, height, scale, mobile), size);
    }
}

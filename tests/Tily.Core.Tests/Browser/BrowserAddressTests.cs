using Tily.Core.Browser;
using Xunit;

namespace Tily.Core.Tests.Browser;

public sealed class BrowserAddressTests
{
    [Theory]
    [InlineData("localhost:5173", "http://localhost:5173/")]
    [InlineData("localhost:5173/equipe?x=1", "http://localhost:5173/equipe?x=1")]
    [InlineData("127.0.0.1:7117/health", "http://127.0.0.1:7117/health")]
    [InlineData("intranet:8080", "http://intranet:8080/")]
    [InlineData("example.com", "https://example.com/")]
    [InlineData("  https://example.com/a b ", "https://example.com/a%20b")]
    [InlineData("http://localhost:5173", "http://localhost:5173/")]
    public void Normalize_WhenAddressWithoutOrWithScheme_ThenAbsoluteUrl(string input, string expected)
    {
        var url = BrowserAddress.Normalize(input);

        Assert.Equal(expected, url);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    [InlineData("About:Blank")]
    public void Normalize_WhenEmptyOrBlank_ThenBlankPage(string? input)
    {
        var url = BrowserAddress.Normalize(input);

        Assert.Equal(BrowserAddress.Blank, url);
    }

    [Fact]
    public void Normalize_WhenWindowsPath_ThenFileUrl()
    {
        var url = BrowserAddress.Normalize(@"C:\Rapports\été.html");

        Assert.Equal("file:///C:/Rapports/%C3%A9t%C3%A9.html", url);
    }

    [Theory]
    [InlineData("javascript:alert(1)")]
    [InlineData("ftp://example.com/fichier")]
    [InlineData("ms-settings://display")]
    public void Normalize_WhenOtherScheme_ThenFailsInFrench(string input)
    {
        var error = Assert.Throws<InvalidOperationException>(() => BrowserAddress.Normalize(input));

        Assert.StartsWith("Adresse invalide", error.Message);
    }

    [Fact]
    public void Normalize_WhenTooLong_ThenFails()
    {
        var error = Assert.Throws<InvalidOperationException>(() => BrowserAddress.Normalize("https://example.com/" + new string('a', BrowserAddress.MaxLength)));

        Assert.StartsWith("Adresse trop longue", error.Message);
    }

    [Theory]
    [InlineData("https://example.com/", true)]
    [InlineData("about:blank", true)]
    [InlineData("file:///C:/page.html", true)]
    [InlineData("mailto:moi@example.com", false)]
    [InlineData(null, false)]
    public void IsAllowed_WhenUrl_ThenOnlyWebAndFileSchemes(string? url, bool expected)
    {
        var allowed = BrowserAddress.IsAllowed(url);

        Assert.Equal(expected, allowed);
    }
}

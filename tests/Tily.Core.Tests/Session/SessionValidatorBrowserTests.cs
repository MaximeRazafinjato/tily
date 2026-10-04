using Tily.Core.Session;
using Xunit;

namespace Tily.Core.Tests.Session;

public sealed class SessionValidatorBrowserTests
{
    private static (SessionModel Session, PaneModel Pane) SessionWithPane(string? kind, string? url, string? viewport)
    {
        var session = SessionFactory.Initial();
        var pane = session.Workspaces[0].Tabs[0].Tree.Pane!;
        pane.Kind = kind;
        pane.Url = url;
        pane.Viewport = viewport;
        return (session, pane);
    }

    [Fact]
    public void Validate_WhenBrowserPane_ThenKeepsAddressAndViewport()
    {
        var (session, pane) = SessionWithPane("browser", "http://localhost:5173/equipe", "mobile");

        var result = SessionValidator.Validate(session);

        Assert.Equal((true, "browser", "http://localhost:5173/equipe", "mobile"), (result.IsValid, pane.Kind, pane.Url, pane.Viewport));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("javascript:alert(1)")]
    [InlineData("ms-settings:display")]
    public void Validate_WhenBrowserAddressMissingOrForbidden_ThenBlankPageWithoutFailing(string? url)
    {
        var (session, pane) = SessionWithPane("browser", url, null);

        var result = SessionValidator.Validate(session);

        Assert.Equal((true, "about:blank"), (result.IsValid, pane.Url));
    }

    [Fact]
    public void Validate_WhenBrowserAddressTooLong_ThenBlankPage()
    {
        var (session, pane) = SessionWithPane("browser", "https://example.com/" + new string('a', 3000), null);

        SessionValidator.Validate(session);

        Assert.Equal("about:blank", pane.Url);
    }

    [Fact]
    public void Validate_WhenUnknownViewport_ThenDropped()
    {
        var (session, pane) = SessionWithPane("browser", "https://example.com/", "tablette");

        SessionValidator.Validate(session);

        Assert.Null(pane.Viewport);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("inconnu")]
    public void Validate_WhenTerminalOrUnknownKind_ThenBrowserFieldsDropped(string? kind)
    {
        var (session, pane) = SessionWithPane(kind, "https://example.com/", "mobile");

        var result = SessionValidator.Validate(session);

        Assert.Equal((true, (string?)null, (string?)null, (string?)null), (result.IsValid, pane.Kind, pane.Url, pane.Viewport));
    }
}

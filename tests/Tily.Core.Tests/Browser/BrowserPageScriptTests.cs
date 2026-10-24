using Tily.Core.Browser;
using Xunit;

namespace Tily.Core.Tests.Browser;

public sealed class BrowserPageScriptTests
{
    [Fact]
    public void Keys_WhenChordRepeated_ThenListedOnce()
    {
        var script = BrowserPageScript.Keys(["Ctrl+Alt+F9", "Ctrl+Alt+F9"]);

        Assert.Single(script.Split("F9").Skip(1));
    }

    [Fact]
    public void Keys_WhenChordContainsScriptTag_ThenEscaped()
    {
        var script = BrowserPageScript.Keys(["</script>"]);

        Assert.DoesNotContain("</script>", script);
    }

    [Fact]
    public void Keys_WhenNoChords_ThenEmptyListAndKeyMessageType()
    {
        var script = BrowserPageScript.Keys([]);

        Assert.Equal((true, true), (script.Contains("new Set([])"), script.Contains($"type: '{BrowserPageScript.KeyMessage}'")));
    }
}

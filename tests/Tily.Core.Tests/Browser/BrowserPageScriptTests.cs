using Tily.Core.Browser;
using Xunit;

namespace Tily.Core.Tests.Browser;

public sealed class BrowserPageScriptTests
{
    [Fact]
    public void Keys_WhenLetters_ThenOnlyDistinctLowercaseAsciiKept()
    {
        var script = BrowserPageScript.Keys("ptdp'</script>Xé");

        Assert.Contains("const letters = 'ptdscri';", script);
    }

    [Fact]
    public void Keys_WhenNoLetters_ThenEmptyListAndKeyMessageType()
    {
        var script = BrowserPageScript.Keys(null);

        Assert.Equal((true, true), (script.Contains("const letters = '';"), script.Contains($"type: '{BrowserPageScript.KeyMessage}'")));
    }
}

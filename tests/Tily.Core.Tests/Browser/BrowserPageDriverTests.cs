using Tily.Core.Browser;
using Xunit;

namespace Tily.Core.Tests.Browser;

public sealed class BrowserPageDriverTests
{
    [Fact]
    public void Point_WhenTargetedByReference_ThenRefSentWithoutEmptyFields()
    {
        var script = BrowserPageDriver.Point(new BrowserTargetModel("e12", null, null, null, null));

        Assert.Contains("""driver.point({"ref":"e12","reachable":true})""", script);
    }

    [Fact]
    public void Field_WhenValueContainsScriptTag_ThenEscaped()
    {
        var script = BrowserPageDriver.Field(null, "</script><b>", false);

        Assert.DoesNotContain("</script>", script);
    }

    [Fact]
    public void Snapshot_WhenCalled_ThenRefusalsReturnedAsErrors()
    {
        var script = BrowserPageDriver.Snapshot(null);

        Assert.Equal((true, true), (script.Contains("driver.snapshot({})"), script.Contains("return { error:")));
    }

    [Fact]
    public void Driving_WhenStarted_ThenFlagSetOnWindow()
    {
        var script = BrowserPageDriver.Driving(true);

        Assert.Equal($"window.{BrowserPageDriver.DrivingFlag} = true", script);
    }
}

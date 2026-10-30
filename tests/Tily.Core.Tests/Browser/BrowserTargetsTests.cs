using Tily.Core.Browser;
using Xunit;

namespace Tily.Core.Tests.Browser;

public sealed class BrowserTargetsTests
{
    [Fact]
    public void Of_WhenNothingGiven_ThenNull()
    {
        var target = BrowserTargets.Of(" ", null, "", null, null);

        Assert.Null(target);
    }

    [Fact]
    public void Of_WhenLabel_ThenTrimmedText()
    {
        var target = BrowserTargets.Of(null, null, "  Se connecter ", null, null);

        Assert.Equal(new BrowserTargetModel(null, null, "Se connecter", null, null), target);
    }

    [Fact]
    public void Of_WhenCoordinates_ThenPoint()
    {
        var target = BrowserTargets.Of(null, null, null, 12, 40);

        Assert.True(target?.IsPoint);
    }

    [Fact]
    public void Of_WhenTwoWays_ThenFailsInFrench()
    {
        var error = Assert.Throws<InvalidOperationException>(() => BrowserTargets.Of("e3", null, null, 10, 10));

        Assert.StartsWith("Indiquez une seule façon de viser l’élément", error.Message);
    }

    [Fact]
    public void Of_WhenOnlyX_ThenFailsInFrench()
    {
        var error = Assert.Throws<InvalidOperationException>(() => BrowserTargets.Of(null, null, null, 10, null));

        Assert.Equal("Indiquez x et y ensemble.", error.Message);
    }

    [Fact]
    public void Of_WhenNegativeCoordinate_ThenFailsInFrench()
    {
        var error = Assert.Throws<InvalidOperationException>(() => BrowserTargets.Of(null, null, null, -1, 10));

        Assert.StartsWith("Les coordonnées x et y doivent être positives", error.Message);
    }

    [Fact]
    public void Required_WhenMissing_ThenFailsInFrench()
    {
        var error = Assert.Throws<InvalidOperationException>(() => BrowserTargets.Required(null));

        Assert.Equal(BrowserTargets.Missing, error.Message);
    }
}

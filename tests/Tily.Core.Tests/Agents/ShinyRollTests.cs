using Tily.Core.Agents;
using Xunit;

namespace Tily.Core.Tests.Agents;

public sealed class ShinyRollTests
{
    [Theory]
    [InlineData("session-142")]
    [InlineData("session-776")]
    [InlineData("agent-259")]
    public void IsShiny_WhenSeedHashIsMultipleOfOdds_ThenTrue(string seed)
    {
        var shiny = ShinyRoll.IsShiny(seed);

        Assert.True(shiny);
    }

    [Theory]
    [InlineData("session-0")]
    [InlineData("session-29")]
    [InlineData("agent-117")]
    [InlineData("3f2c8a51-6d0e-4b7a-9c1f-2e5d7a9b0c14")]
    public void IsShiny_WhenSeedHashIsNotMultipleOfOdds_ThenFalse(string seed)
    {
        var shiny = ShinyRoll.IsShiny(seed);

        Assert.False(shiny);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void IsShiny_WhenSeedMissing_ThenFalse(string? seed)
    {
        var shiny = ShinyRoll.IsShiny(seed);

        Assert.False(shiny);
    }

    [Fact]
    public void IsShiny_WhenManyRandomSessions_ThenAboutOneInOdds()
    {
        const double sessions = 400_000;
        const double expected = sessions / ShinyRoll.Odds;

        double shinies = Enumerable.Range(0, (int)sessions).Count(_ => ShinyRoll.IsShiny(Guid.NewGuid().ToString()));

        Assert.InRange(shinies, expected * 0.8, expected * 1.2);
    }
}

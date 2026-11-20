using Tily.Core.Clone;
using Xunit;

namespace Tily.Core.Tests.Clone;

public sealed class CloneAddressTests
{
    [Theory]
    [InlineData("https://github.com/MaximeRazafinjato/tily.git")]
    [InlineData("http://serveur.local/depot")]
    [InlineData("ssh://git@gitlab.com:2222/groupe/sous-groupe/projet.git")]
    [InlineData("git://exemple.org/depot.git")]
    [InlineData("file:///C:/Depots/projet.git")]
    [InlineData("git@github.com:MaximeRazafinjato/tily.git")]
    [InlineData("  https://github.com/org/depot  ")]
    public void Error_WhenSupportedAddress_ThenAccepts(string address)
    {
        var error = CloneAddress.Error(address.Trim());

        Assert.Null(error);
    }

    [Theory]
    [InlineData(@"C:\Depots\projet", "Adresse de dépôt non reconnue")]
    [InlineData("ext::sh -c touch% /tmp/pwned", "Adresse de dépôt invalide")]
    [InlineData("--upload-pack=calc", "Adresse de dépôt invalide")]
    [InlineData("https://github.com/org/dé pôt", "Adresse de dépôt invalide")]
    [InlineData("ftp://exemple.org/depot.git", "Adresse de dépôt non reconnue")]
    public void Error_WhenUnsafeOrUnknownAddress_ThenRefusesInFrench(string address, string expected)
    {
        var error = CloneAddress.Error(address);

        Assert.StartsWith(expected, error);
    }

    [Fact]
    public void Require_WhenAddressBlank_ThenAsksForIt()
    {
        var failure = Assert.Throws<CloneException>(() => CloneAddress.Require("   "));

        Assert.Equal("Indiquez l’adresse du dépôt.", failure.Message);
    }

    [Theory]
    [InlineData("https://github.com/MaximeRazafinjato/tily.git", "tily")]
    [InlineData("https://github.com/MaximeRazafinjato/tily/", "tily")]
    [InlineData("git@gitlab.com:groupe/sous-groupe/App.Starter.Kit.GIT", "App.Starter.Kit")]
    [InlineData("https://dev.azure.com/org/projet/_git/Mon%20D%C3%A9p%C3%B4t", "Mon Dépôt")]
    [InlineData("https://serveur.local/depot.git?ref=main#readme", "depot")]
    [InlineData("file:///C:/Depots/projet.git", "projet")]
    [InlineData("https://github.com", "")]
    public void NameOf_WhenAddressGiven_ThenKeepsLastSegmentWithoutGitSuffix(string address, string expected)
    {
        var name = CloneAddress.NameOf(address);

        Assert.Equal(expected, name);
    }

    [Theory]
    [InlineData("https://github.com/MaximeRazafinjato/tily")]
    [InlineData("https://gitlab.com/groupe/sous-groupe/projet")]
    [InlineData("https://gitlab.entreprise.fr/groupe/projet.git")]
    [InlineData("https://dev.azure.com/org/projet/_git/depot")]
    [InlineData("https://serveur.local/depot.git")]
    [InlineData("git@github.com:org/depot.git")]
    [InlineData("ssh://git@serveur.local/depot")]
    public void Suggestion_WhenClipboardHoldsRepositoryAddress_ThenKeepsIt(string text)
    {
        var suggestion = CloneAddress.Suggestion($" {text}\n");

        Assert.Equal(text, suggestion);
    }

    [Theory]
    [InlineData("https://github.com/MaximeRazafinjato/tily/pull/12")]
    [InlineData("https://gitlab.com/groupe/projet/-/merge_requests/3")]
    [InlineData("https://www.google.com/search")]
    [InlineData(@"C:\Files\Projects\tily")]
    [InlineData("mot de passe")]
    [InlineData("")]
    public void Suggestion_WhenClipboardHoldsSomethingElse_ThenIgnoresIt(string text)
    {
        var suggestion = CloneAddress.Suggestion(text);

        Assert.Null(suggestion);
    }
}

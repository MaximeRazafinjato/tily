using Tily.Core.Updates;
using Xunit;

namespace Tily.Core.Tests.Updates;

public sealed class ReleaseParserTests
{
    private const string Digest = "353bdf3f96f05e5a71203e1ab34e6437dd9a99cc67ad558c743cbbbc0bddef99";

    internal static string ReleaseJson(string tag = "v1.4.0", string assetName = "Tily-1.4.0-setup.exe", string? digest = "sha256:" + Digest, string? url = null, bool prerelease = false) =>
        $$"""
        {
          "tag_name": "{{tag}}",
          "prerelease": {{(prerelease ? "true" : "false")}},
          "name": "Tily 1.4.0",
          "html_url": "https://github.com/MaximeRazafinjato/tily/releases/tag/{{tag}}",
          "published_at": "2026-09-30T08:00:00Z",
          "body": "Intro.\r\n\r\n## Installation\r\n1. Lancer.\r\n\r\n## Nouveautés\r\n- Mises à jour dans l’application.\r\n- Libellés.\r\n",
          "assets": [
            {
              "name": "{{assetName}}",
              "size": 1234,
              "digest": {{(digest is null ? "null" : $"\"{digest}\"")}},
              "browser_download_url": "{{url ?? $"https://github.com/MaximeRazafinjato/tily/releases/download/{tag}/{assetName}"}}"
            }
          ]
        }
        """;

    [Fact]
    public void Parse_WhenReleaseComplete_ThenReadsVersionNotesAndInstaller()
    {
        var json = ReleaseJson();

        var release = ReleaseParser.Parse(json);

        Assert.Equal(
            new UpdateAssetModel("Tily-1.4.0-setup.exe", "https://github.com/MaximeRazafinjato/tily/releases/download/v1.4.0/Tily-1.4.0-setup.exe", 1234, Digest),
            release.Installer);
        Assert.Equal("1.4.0", release.Version);
        Assert.Equal(["Mises à jour dans l’application.", "Libellés."], release.Notes);
    }

    [Fact]
    public void Parse_WhenInstallerMissing_ThenFailsInFrench()
    {
        var json = ReleaseJson(assetName: "Tily-1.4.0-portable.zip");

        var exception = Assert.Throws<UpdateException>(() => ReleaseParser.Parse(json));

        Assert.Equal("La release 1.4.0 ne contient pas d’installeur Tily-1.4.0-setup.exe.", exception.Message);
    }

    [Fact]
    public void Parse_WhenDigestMissing_ThenRefusesUnverifiableInstaller()
    {
        var json = ReleaseJson(digest: null);

        var exception = Assert.Throws<UpdateException>(() => ReleaseParser.Parse(json));

        Assert.Contains("empreinte SHA-256", exception.Message);
    }

    [Fact]
    public void Parse_WhenDownloadOutsideRepository_ThenRefusesUrl()
    {
        var json = ReleaseJson(url: "https://example.com/Tily-1.4.0-setup.exe");

        var exception = Assert.Throws<UpdateException>(() => ReleaseParser.Parse(json));

        Assert.StartsWith("Adresse de téléchargement refusée", exception.Message);
    }

    [Fact]
    public void Parse_WhenTagNotAVersion_ThenFailsInFrench()
    {
        var json = ReleaseJson(tag: "nightly");

        var exception = Assert.Throws<UpdateException>(() => ReleaseParser.Parse(json));

        Assert.Equal("Numéro de version illisible dans la release : « nightly ».", exception.Message);
    }

    [Fact]
    public void Parse_WhenJsonInvalid_ThenFailsInFrench()
    {
        var exception = Assert.Throws<UpdateException>(() => ReleaseParser.Parse("<html>"));

        Assert.Equal("Réponse de GitHub illisible.", exception.Message);
    }

    [Fact]
    public void ParseLatestPrerelease_WhenStableAndBetaListed_ThenReadsFirstBetaInstaller()
    {
        var json = $"[{ReleaseJson()}, {ReleaseJson("v1.5.0-beta.2", "TilyBeta-1.5.0-beta.2-setup.exe", prerelease: true)}, {ReleaseJson("v1.5.0-beta.1", "TilyBeta-1.5.0-beta.1-setup.exe", prerelease: true)}]";

        var release = ReleaseParser.ParseLatestPrerelease(json, ReleaseChannel.Beta);

        Assert.Equal("1.5.0-beta.2", release.Version);
        Assert.Equal("TilyBeta-1.5.0-beta.2-setup.exe", release.Installer.Name);
    }

    [Fact]
    public void ParseLatestPrerelease_WhenOnlyStableReleases_ThenFailsInFrench()
    {
        var json = $"[{ReleaseJson()}]";

        var exception = Assert.Throws<UpdateException>(() => ReleaseParser.ParseLatestPrerelease(json, ReleaseChannel.Beta));

        Assert.Equal("Aucune version de Tily Beta n’est publiée sur GitHub.", exception.Message);
    }

    [Fact]
    public void ParseLatestPrerelease_WhenBetaHasOnlyStableInstaller_ThenFailsInFrench()
    {
        var json = $"[{ReleaseJson("v1.5.0-beta.1", "Tily-1.5.0-beta.1-setup.exe", prerelease: true)}]";

        var exception = Assert.Throws<UpdateException>(() => ReleaseParser.ParseLatestPrerelease(json, ReleaseChannel.Beta));

        Assert.Equal("La release 1.5.0-beta.1 ne contient pas d’installeur TilyBeta-1.5.0-beta.1-setup.exe.", exception.Message);
    }

    [Fact]
    public void ParseLatestPrerelease_WhenAnswerNotAList_ThenFailsInFrench()
    {
        var exception = Assert.Throws<UpdateException>(() => ReleaseParser.ParseLatestPrerelease(ReleaseJson(), ReleaseChannel.Beta));

        Assert.Equal("Réponse de GitHub inattendue.", exception.Message);
    }

    [Theory]
    [InlineData("1.5.0-beta.2", "1.5.0-beta.1", true)]
    [InlineData("1.4.0", "1.3.0", true)]
    [InlineData("1.10.0", "1.9.2", true)]
    [InlineData("1.3.0", "1.3.0", false)]
    [InlineData("1.2.0", "1.3.0", false)]
    [InlineData("1.4.0", "", false)]
    public void IsNewerThan_WhenComparingVersions_ThenComparesNumerically(string available, string current, bool expected)
    {
        var release = ReleaseParser.Parse(ReleaseJson()) with { Version = available };

        var newer = release.IsNewerThan(current);

        Assert.Equal(expected, newer);
    }
}

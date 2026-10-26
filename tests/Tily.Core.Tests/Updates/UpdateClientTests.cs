using System.Net;
using System.Security.Cryptography;
using System.Text;
using Tily.Core.Updates;
using Xunit;

namespace Tily.Core.Tests.Updates;

public sealed class UpdateClientTests : IDisposable
{
    private static readonly byte[] Installer = Encoding.UTF8.GetBytes("faux installeur de Tily");
    private readonly string _directory = Path.Combine(Path.GetTempPath(), "tily-tests-" + Guid.NewGuid().ToString("N"));

    private static UpdateAssetModel AssetWith(string sha256) =>
        new("Tily-1.4.0-setup.exe", ReleaseParser.DownloadPrefix + "v1.4.0/Tily-1.4.0-setup.exe", Installer.Length, sha256);

    private static UpdateClient ClientAnswering(HttpStatusCode status, byte[] content) =>
        new(new HttpClient(new FixedHandler(status, content)));

    [Fact]
    public async Task LatestAsync_WhenGitHubAnswers_ThenParsesRelease()
    {
        var client = ClientAnswering(HttpStatusCode.OK, Encoding.UTF8.GetBytes(ReleaseParserTests.ReleaseJson()));

        var release = await client.LatestAsync(CancellationToken.None);

        Assert.Equal("1.4.0", release.Version);
    }

    [Fact]
    public async Task LatestAsync_WhenBetaChannel_ThenParsesLatestPrerelease()
    {
        var releases = $"[{ReleaseParserTests.ReleaseJson()}, {ReleaseParserTests.ReleaseJson("v1.5.0-beta.1", "TilyBeta-1.5.0-beta.1-setup.exe", prerelease: true)}]";
        var client = new UpdateClient(new HttpClient(new FixedHandler(HttpStatusCode.OK, Encoding.UTF8.GetBytes(releases))), ReleaseChannel.Beta);

        var release = await client.LatestAsync(CancellationToken.None);

        Assert.Equal("1.5.0-beta.1", release.Version);
    }

    [Theory]
    [InlineData(HttpStatusCode.NotFound, "Aucune version de Tily n’est publiée sur GitHub.")]
    [InlineData(HttpStatusCode.Forbidden, "GitHub limite le nombre de vérifications : réessayez dans une heure.")]
    [InlineData(HttpStatusCode.InternalServerError, "GitHub a répondu 500 (InternalServerError).")]
    public async Task LatestAsync_WhenGitHubRefuses_ThenFailsInFrench(HttpStatusCode status, string expected)
    {
        var client = ClientAnswering(status, []);

        var exception = await Assert.ThrowsAsync<UpdateException>(() => client.LatestAsync(CancellationToken.None));

        Assert.Equal(expected, exception.Message);
    }

    [Fact]
    public async Task DownloadAsync_WhenDigestMatches_ThenWritesInstallerAndReportsProgress()
    {
        var client = ClientAnswering(HttpStatusCode.OK, Installer);
        long reported = 0;

        var path = await client.DownloadAsync(AssetWith(Convert.ToHexStringLower(SHA256.HashData(Installer))), _directory, (received, _) => reported = received, CancellationToken.None);

        Assert.Equal(Installer, File.ReadAllBytes(path));
        Assert.Equal(Installer.Length, reported);
    }

    [Fact]
    public async Task DownloadAsync_WhenDigestDiffers_ThenDeletesFileAndFails()
    {
        var client = ClientAnswering(HttpStatusCode.OK, Installer);

        var exception = await Assert.ThrowsAsync<UpdateException>(() => client.DownloadAsync(AssetWith(new string('0', 64)), _directory, (_, _) => { }, CancellationToken.None));

        Assert.StartsWith("L’installeur téléchargé ne correspond pas à l’empreinte SHA-256 publiée", exception.Message);
        Assert.Empty(Directory.GetFiles(_directory));
    }

    [Fact]
    public void Clean_WhenDownloadsRemain_ThenDeletesThem()
    {
        Directory.CreateDirectory(_directory);
        File.WriteAllText(Path.Combine(_directory, "Tily-1.3.0-setup.exe"), "ancien");

        UpdateClient.Clean(_directory);

        Assert.Empty(Directory.GetFiles(_directory));
    }

    public void Dispose()
    {
        if (Directory.Exists(_directory))
        {
            Directory.Delete(_directory, true);
        }
    }

    private sealed class FixedHandler(HttpStatusCode status, byte[] content) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(new HttpResponseMessage(status) { Content = new ByteArrayContent(content) });
    }
}

using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;

namespace Tily.Core.Updates;

public sealed class UpdateClient(HttpClient http)
{
    private const int BufferSize = 81920;
    private const string PartialExtension = ".part";
    private const string DownloadDirectoryName = "updates";

    public static string DownloadDirectory(string dataDirectory) => Path.Combine(dataDirectory, DownloadDirectoryName);

    public static HttpClient CreateHttpClient(string currentVersion)
    {
        var http = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        http.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("Tily", currentVersion.Length > 0 ? currentVersion : "0.0.0"));
        return http;
    }

    public async Task<UpdateReleaseModel> LatestAsync(CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, UpdateSource.LatestReleaseUrl);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
        request.Headers.Add("X-GitHub-Api-Version", "2022-11-28");
        using var response = await SendAsync(request, cancellationToken);
        return ReleaseParser.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
    }

    public async Task<string> DownloadAsync(UpdateAssetModel asset, string directory, Action<long, long> progress, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(directory);
        var target = Path.Combine(directory, asset.Name);
        var partial = target + PartialExtension;
        using var request = new HttpRequestMessage(HttpMethod.Get, asset.Url);
        using var response = await SendAsync(request, cancellationToken, HttpCompletionOption.ResponseHeadersRead);
        var total = response.Content.Headers.ContentLength ?? asset.Size;
        string digest;
        try
        {
            await using var source = await response.Content.ReadAsStreamAsync(cancellationToken);
            await using var file = new FileStream(partial, FileMode.Create, FileAccess.Write, FileShare.None, BufferSize, true);
            using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
            var buffer = new byte[BufferSize];
            long received = 0;
            int read;
            while ((read = await source.ReadAsync(buffer, cancellationToken)) > 0)
            {
                await file.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
                hash.AppendData(buffer, 0, read);
                received += read;
                progress(received, total);
            }

            digest = Convert.ToHexStringLower(hash.GetHashAndReset());
        }
        catch
        {
            DeleteQuietly(partial);
            throw;
        }

        if (!string.Equals(digest, asset.Sha256, StringComparison.OrdinalIgnoreCase))
        {
            DeleteQuietly(partial);
            throw new UpdateException("L’installeur téléchargé ne correspond pas à l’empreinte SHA-256 publiée : fichier supprimé, rien n’a été installé.");
        }

        File.Move(partial, target, true);
        return target;
    }

    public static void Clean(string directory)
    {
        if (!Directory.Exists(directory))
        {
            return;
        }

        foreach (var file in Directory.EnumerateFiles(directory))
        {
            DeleteQuietly(file);
        }
    }

    private async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken, HttpCompletionOption completion = HttpCompletionOption.ResponseContentRead)
    {
        HttpResponseMessage response;
        try
        {
            response = await http.SendAsync(request, completion, cancellationToken);
        }
        catch (HttpRequestException exception)
        {
            throw new UpdateException($"Impossible de joindre GitHub : {exception.Message}");
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new UpdateException("GitHub ne répond pas : réessayez plus tard.");
        }

        if (response.IsSuccessStatusCode)
        {
            return response;
        }

        var status = response.StatusCode;
        response.Dispose();
        throw new UpdateException(status switch
        {
            HttpStatusCode.NotFound => "Aucune version de Tily n’est publiée sur GitHub.",
            HttpStatusCode.Forbidden or HttpStatusCode.TooManyRequests => "GitHub limite le nombre de vérifications : réessayez dans une heure.",
            _ => $"GitHub a répondu {(int)status} ({status})."
        });
    }

    private static void DeleteQuietly(string path)
    {
        try
        {
            File.Delete(path);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
        }
    }
}

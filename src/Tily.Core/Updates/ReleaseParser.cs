using System.Text.Json;

namespace Tily.Core.Updates;

public static class ReleaseParser
{
    public const string DownloadPrefix = "https://github.com/" + UpdateSource.Repository + "/releases/download/";
    private const string Sha256Prefix = "sha256:";

    public static UpdateReleaseModel Parse(string json, ReleaseChannel channel = ReleaseChannel.Stable) =>
        Read(json, root => Release(root, channel));

    public static UpdateReleaseModel ParseLatestPrerelease(string json, ReleaseChannel channel) =>
        Read(json, root =>
        {
            var prerelease = root.EnumerateArray().FirstOrDefault(IsPrerelease);
            if (prerelease.ValueKind != JsonValueKind.Object)
            {
                throw new UpdateException($"Aucune version de {ReleaseChannels.ApplicationName(channel)} n’est publiée sur GitHub.");
            }

            return Release(prerelease, channel);
        });

    private static UpdateReleaseModel Read(string json, Func<JsonElement, UpdateReleaseModel> release)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            return release(document.RootElement);
        }
        catch (JsonException)
        {
            throw new UpdateException("Réponse de GitHub illisible.");
        }
        catch (InvalidOperationException)
        {
            throw new UpdateException("Réponse de GitHub inattendue.");
        }
    }

    private static UpdateReleaseModel Release(JsonElement root, ReleaseChannel channel)
    {
        var tag = Text(root, "tag_name");
        var version = tag.TrimStart('v', 'V');
        if (ReleaseVersion.Parse(version) is null)
        {
            throw new UpdateException($"Numéro de version illisible dans la release : « {tag} ».");
        }

        var name = Text(root, "name");
        DateTimeOffset? publishedAt = root.TryGetProperty("published_at", out var published) && published.ValueKind == JsonValueKind.String && published.TryGetDateTimeOffset(out var date) ? date : null;
        return new UpdateReleaseModel(
            version,
            name.Length > 0 ? name : $"{ReleaseChannels.ApplicationName(channel)} {version}",
            ReleaseNotes.Highlights(Text(root, "body")),
            Text(root, "html_url"),
            publishedAt,
            Installer(root, version, channel));
    }

    private static bool IsPrerelease(JsonElement release) =>
        release.ValueKind == JsonValueKind.Object && release.TryGetProperty("prerelease", out var flag) && flag.ValueKind == JsonValueKind.True;

    private static UpdateAssetModel Installer(JsonElement root, string version, ReleaseChannel channel)
    {
        var assets = root.TryGetProperty("assets", out var list) && list.ValueKind == JsonValueKind.Array ? list.EnumerateArray().ToList() : [];
        var expected = ReleaseChannels.InstallerName(channel, version);
        var asset = assets.FirstOrDefault(candidate => string.Equals(Text(candidate, "name"), expected, StringComparison.OrdinalIgnoreCase));
        if (asset.ValueKind != JsonValueKind.Object)
        {
            throw new UpdateException($"La release {version} ne contient pas d’installeur {expected}.");
        }

        var url = Text(asset, "browser_download_url");
        if (!url.StartsWith(DownloadPrefix, StringComparison.Ordinal))
        {
            throw new UpdateException($"Adresse de téléchargement refusée : {url}");
        }

        var digest = Text(asset, "digest");
        if (!digest.StartsWith(Sha256Prefix, StringComparison.OrdinalIgnoreCase) || digest.Length != Sha256Prefix.Length + 64)
        {
            throw new UpdateException($"L’installeur {expected} n’a pas d’empreinte SHA-256 publiée : impossible de vérifier le téléchargement.");
        }

        var size = asset.TryGetProperty("size", out var bytes) && bytes.TryGetInt64(out var value) ? value : 0;
        return new UpdateAssetModel(expected, url, size, digest[Sha256Prefix.Length..].ToLowerInvariant());
    }

    private static string Text(JsonElement element, string property) =>
        element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() ?? string.Empty : string.Empty;
}

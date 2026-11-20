using System.Text.RegularExpressions;

namespace Tily.Core.Clone;

public static partial class CloneAddress
{
    private const int MaxLength = 2048;
    private const string GitSuffix = ".git";
    private const string GitLabPathSeparator = "-";
    private const string AzureRepositoryMarker = "_git";

    public static string Require(string? text)
    {
        var address = Normalize(text) ?? throw new CloneException("Indiquez l’adresse du dépôt.");
        return Error(address) is { } error ? throw new CloneException(error) : address;
    }

    public static string? Error(string address)
    {
        if (address.Length > MaxLength)
        {
            return $"L’adresse du dépôt dépasse {MaxLength} caractères.";
        }

        if (address.StartsWith('-') || address.Contains("::", StringComparison.Ordinal) || address.Any(character => char.IsWhiteSpace(character) || char.IsControl(character)))
        {
            return $"Adresse de dépôt invalide : {address}";
        }

        return Url().IsMatch(address) || ScpLike().IsMatch(address)
            ? null
            : $"Adresse de dépôt non reconnue : {address}. Utilisez une adresse https://, ssh://, git://, file:// ou utilisateur@hôte:chemin.";
    }

    public static string NameOf(string address)
    {
        var segment = PathOf(address).TrimEnd('/', '\\').Split('/', '\\').LastOrDefault() ?? string.Empty;
        if (segment.EndsWith(GitSuffix, StringComparison.OrdinalIgnoreCase))
        {
            segment = segment[..^GitSuffix.Length];
        }

        return Uri.UnescapeDataString(segment).Trim();
    }

    public static string? Suggestion(string? text)
    {
        if (Normalize(text) is not { } address || Error(address) is not null)
        {
            return null;
        }

        if (Url().Match(address) is not { Success: true } url || !url.Groups["scheme"].Value.StartsWith("http", StringComparison.OrdinalIgnoreCase))
        {
            return address;
        }

        var path = PathOf(address);
        var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        var host = url.Groups["host"].Value.Split('@')[^1].Split(':')[0].ToLowerInvariant();
        var repository = path.EndsWith(GitSuffix, StringComparison.OrdinalIgnoreCase) || host switch
        {
            "github.com" or "bitbucket.org" or "codeberg.org" => segments.Length == 2,
            "dev.azure.com" => segments.Length == 4 && segments[2] == AzureRepositoryMarker,
            _ when host.StartsWith("gitlab.", StringComparison.Ordinal) => segments.Length >= 2 && !segments.Contains(GitLabPathSeparator),
            _ => false
        };
        return repository ? address : null;
    }

    private static string PathOf(string address)
    {
        var path = Url().Match(address) is { Success: true } url ? url.Groups["path"].Value : ScpLike().Match(address).Groups["path"].Value;
        return path.Split('?', '#')[0];
    }

    private static string? Normalize(string? text) => string.IsNullOrWhiteSpace(text) ? null : text.Trim();

    [GeneratedRegex(@"^(?<scheme>https?|ssh|git|file)://(?<host>[^/]*)(?<path>/.*)?$", RegexOptions.IgnoreCase)]
    private static partial Regex Url();

    [GeneratedRegex(@"^[^@/\\:]+@[^@/\\:]+:(?<path>[^\\].*)$")]
    private static partial Regex ScpLike();
}

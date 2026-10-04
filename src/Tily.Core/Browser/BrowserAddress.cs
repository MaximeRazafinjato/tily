namespace Tily.Core.Browser;

public static class BrowserAddress
{
    public const string Blank = "about:blank";
    public const int MaxLength = 2048;
    private const string SchemeSeparator = "://";
    private static readonly string[] AllowedSchemes = [Uri.UriSchemeHttp, Uri.UriSchemeHttps, Uri.UriSchemeFile];

    public static string Normalize(string? input)
    {
        var text = input?.Trim() ?? string.Empty;
        if (text.Length == 0 || text.Equals(Blank, StringComparison.OrdinalIgnoreCase))
        {
            return Blank;
        }

        if (text.Length > MaxLength)
        {
            throw new InvalidOperationException($"Adresse trop longue : {MaxLength} caractères au plus.");
        }

        if (Path.IsPathFullyQualified(text) && !text.Contains(SchemeSeparator, StringComparison.Ordinal))
        {
            return new Uri(text).AbsoluteUri;
        }

        var candidate = text.Contains(SchemeSeparator, StringComparison.Ordinal) ? text : $"{DefaultScheme(text)}{SchemeSeparator}{text}";
        if (!Uri.TryCreate(candidate, UriKind.Absolute, out var uri) || !AllowedSchemes.Contains(uri.Scheme, StringComparer.OrdinalIgnoreCase) || (uri.Scheme != Uri.UriSchemeFile && uri.Host.Length == 0))
        {
            throw new InvalidOperationException($"Adresse invalide : « {text} ». Le navigateur de Tily ouvre les adresses http, https et file.");
        }

        return uri.AbsoluteUri;
    }

    public static bool IsAllowed(string? url) =>
        url is not null
        && (url.Equals(Blank, StringComparison.OrdinalIgnoreCase)
            || (Uri.TryCreate(url, UriKind.Absolute, out var uri) && AllowedSchemes.Contains(uri.Scheme, StringComparer.OrdinalIgnoreCase)));

    private static string DefaultScheme(string text)
    {
        var host = text.Split('/', '?', '#')[0];
        var name = host.StartsWith('[') ? host : host.Split(':')[0];
        return IsLocal(name) ? Uri.UriSchemeHttp : Uri.UriSchemeHttps;
    }

    private static bool IsLocal(string host) =>
        host.Equals("localhost", StringComparison.OrdinalIgnoreCase)
        || host.EndsWith(".localhost", StringComparison.OrdinalIgnoreCase)
        || host.StartsWith('[')
        || System.Net.IPAddress.TryParse(host, out _)
        || !host.Contains('.');
}

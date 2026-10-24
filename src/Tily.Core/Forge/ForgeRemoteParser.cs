using System.Text.RegularExpressions;

namespace Tily.Core.Forge;

public static partial class ForgeRemoteParser
{
    private const string GitHubHost = "github.com";
    private const string GitLabHost = "gitlab.com";
    private const string GitSuffix = ".git";
    private static readonly string[] GitHubAliases = [GitHubHost, "www.github.com", "ssh.github.com"];
    private static readonly string[] RemoteSchemes = ["https", "http", "ssh", "git"];

    public static ForgeRemoteModel Parse(string url, Func<string, bool> isGitLabHost)
    {
        var address = url.Trim();
        var (host, path, secure) = Split(address) ?? throw new ForgeException($"Adresse du dépôt distant « origin » non reconnue : {address}");
        var project = ProjectOf(path);
        var kind = KindOf(host, isGitLabHost) ?? throw new ForgeException($"Hébergeur non pris en charge : {host}. Tily gère GitHub et GitLab (gitlab.com ou une instance déclarée dans glab).");
        var segments = project.Split('/');
        if (segments.Length < 2 || (kind == ForgeKind.GitHub && segments.Length != 2))
        {
            throw new ForgeException($"Projet illisible dans l’adresse du dépôt distant « origin » : {address}");
        }

        var forgeHost = kind == ForgeKind.GitHub ? GitHubHost : host;
        return new ForgeRemoteModel(kind, forgeHost, project, $"{(secure ? "https" : "http")}://{forgeHost}/{project}");
    }

    private static (string Host, string Path, bool Secure)? Split(string address)
    {
        if (address.Contains("://", StringComparison.Ordinal))
        {
            return Uri.TryCreate(address, UriKind.Absolute, out var uri) && RemoteSchemes.Contains(uri.Scheme) && uri.Host.Length > 0
                ? (uri.Host.ToLowerInvariant(), Uri.UnescapeDataString(uri.AbsolutePath), uri.Scheme != Uri.UriSchemeHttp)
                : null;
        }

        var match = ScpLike().Match(address);
        return match.Success ? (match.Groups["host"].Value.ToLowerInvariant(), match.Groups["path"].Value, true) : null;
    }

    private static string ProjectOf(string path)
    {
        var project = path.Trim('/');
        return project.EndsWith(GitSuffix, StringComparison.OrdinalIgnoreCase) ? project[..^GitSuffix.Length] : project;
    }

    private static ForgeKind? KindOf(string host, Func<string, bool> isGitLabHost)
    {
        if (GitHubAliases.Contains(host))
        {
            return ForgeKind.GitHub;
        }

        return host == GitLabHost || host.StartsWith("gitlab.", StringComparison.Ordinal) || isGitLabHost(host) ? ForgeKind.GitLab : null;
    }

    [GeneratedRegex(@"^(?:[^@/\s]+@)?(?<host>[^:/\s]{2,}):(?<path>[^\s]+)$")]
    private static partial Regex ScpLike();
}

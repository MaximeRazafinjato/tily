namespace Tily.Core.Forge;

public static class ForgeErrors
{
    private static readonly string[] AuthenticationSigns = ["401", "unauthorized", "auth login", "not logged", "authentication", "bad credentials", "no token"];
    private static readonly string[] NetworkSigns = ["timeout", "timed out", "no such host", "dial tcp", "could not resolve host", "connection refused", "error connecting", "network is unreachable"];
    private static readonly string[] MissingSigns = ["404", "not found", "could not resolve to a repository"];
    private static readonly string[] RefusedSigns = ["403", "forbidden", "rate limit"];

    public static string Describe(ForgeRemoteModel remote, ForgeOutputModel output)
    {
        var cli = ForgeCliRunner.CliName(remote.Kind);
        var text = $"{output.Error}\n{output.Output}";
        if (Contains(text, AuthenticationSigns))
        {
            var login = remote.Kind == ForgeKind.GitHub ? "gh auth login" : $"glab auth login --hostname {remote.Host}";
            return $"« {cli} » n’est pas authentifié sur {remote.Host} : lancez « {login} » dans un terminal.";
        }

        if (Contains(text, NetworkSigns))
        {
            return $"{remote.Host} est injoignable : vérifiez la connexion réseau ou le VPN.";
        }

        if (Contains(text, MissingSigns))
        {
            return $"Projet « {remote.Project} » introuvable sur {remote.Host}, ou inaccessible au compte de « {cli} ».";
        }

        if (Contains(text, RefusedSigns))
        {
            return $"{remote.Host} refuse la demande : droits insuffisants ou limite de requêtes atteinte.";
        }

        var detail = FirstLine(text);
        return detail.Length == 0 ? $"« {cli} » a échoué (code {output.ExitCode})." : $"« {cli} » a échoué : {detail}";
    }

    private static bool Contains(string text, IEnumerable<string> signs) => signs.Any(sign => text.Contains(sign, StringComparison.OrdinalIgnoreCase));

    private static string FirstLine(string text) =>
        text.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .FirstOrDefault(line => !line.Equals("ERROR", StringComparison.OrdinalIgnoreCase)) ?? string.Empty;
}

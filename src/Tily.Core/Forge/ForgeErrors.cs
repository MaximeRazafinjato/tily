using System.Text.Json;

namespace Tily.Core.Forge;

public static class ForgeErrors
{
    private static readonly string[] AuthenticationSigns = ["401", "unauthorized", "auth login", "not logged", "authentication", "bad credentials", "no token"];
    private static readonly string[] NetworkSigns = ["timeout", "timed out", "no such host", "dial tcp", "could not resolve host", "connection refused", "error connecting", "network is unreachable"];
    private static readonly string[] MissingSigns = ["404", "not found", "could not resolve to a repository"];
    private static readonly string[] RefusedSigns = ["403", "forbidden", "rate limit"];
    private static readonly string[] InvalidRequestSigns = ["HTTP 400", "HTTP 409", "HTTP 422"];

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

    public static string DescribeRequest(ForgeRemoteModel remote, ForgeOutputModel output)
    {
        var messages = ApiMessages(output.Output);
        if (messages.Count == 0 || !Contains(output.Error, InvalidRequestSigns))
        {
            return Describe(remote, output);
        }

        var noun = MergeRequestInputs.Noun(remote.Kind);
        var text = string.Join(" ; ", messages);
        if (text.Contains("already exists", StringComparison.OrdinalIgnoreCase))
        {
            return $"Une {noun} ouverte existe déjà pour cette branche source sur {remote.Host}.";
        }

        if (text.Contains("no commits between", StringComparison.OrdinalIgnoreCase))
        {
            return "Aucun commit à fusionner entre la branche source et la branche cible.";
        }

        if (text.Contains("draft pull requests are not supported", StringComparison.OrdinalIgnoreCase))
        {
            return "Ce dépôt n’accepte pas les PR en brouillon : décochez « Créer en brouillon ».";
        }

        if (text.Contains("head invalid", StringComparison.OrdinalIgnoreCase))
        {
            return $"Branche source introuvable sur {remote.Host} : poussez-la avant de créer la {noun}.";
        }

        if (text.Contains("base invalid", StringComparison.OrdinalIgnoreCase))
        {
            return $"Branche cible introuvable sur {remote.Host}.";
        }

        return $"{remote.Host} refuse la {noun} : {text}";
    }

    private static IReadOnlyList<string> ApiMessages(string json)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return [];
            }

            var messages = new List<string>();
            foreach (var name in new[] { "message", "error" })
            {
                if (root.TryGetProperty(name, out var value))
                {
                    messages.AddRange(Flatten(value, null));
                }
            }

            foreach (var error in ForgeJson.Items(root, "errors"))
            {
                messages.AddRange(error.ValueKind != JsonValueKind.Object
                    ? Flatten(error, null)
                    : error.TryGetProperty("message", out var message)
                        ? Flatten(message, null)
                        : [$"{ForgeJson.Text(error, "field")} {ForgeJson.Text(error, "code")}".Trim()]);
            }

            return messages.Where(message => message.Length > 0 && !message.Equals("Validation Failed", StringComparison.OrdinalIgnoreCase)).Distinct().ToList();
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private static IEnumerable<string> Flatten(JsonElement value, string? field) => value.ValueKind switch
    {
        JsonValueKind.String => [field is null ? value.GetString()?.Trim() ?? string.Empty : $"{field} {value.GetString()?.Trim()}"],
        JsonValueKind.Array => value.EnumerateArray().SelectMany(item => Flatten(item, field)),
        JsonValueKind.Object => value.EnumerateObject().SelectMany(property => Flatten(property.Value, property.Name)),
        _ => []
    };

    private static bool Contains(string text, IEnumerable<string> signs) => signs.Any(sign => text.Contains(sign, StringComparison.OrdinalIgnoreCase));

    private static string FirstLine(string text) =>
        text.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .FirstOrDefault(line => !line.Equals("ERROR", StringComparison.OrdinalIgnoreCase)) ?? string.Empty;
}

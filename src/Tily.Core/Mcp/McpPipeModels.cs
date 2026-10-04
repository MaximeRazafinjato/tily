using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Tily.Core.Mcp;

public sealed record McpPipeRequestModel(string Tool, string? Pane, JsonElement? Arguments);

public sealed record McpPipeResponseModel(JsonElement? Result, string? Error)
{
    public static McpPipeResponseModel Failure(string message) => new(null, message);

    public static McpPipeResponseModel Success(JsonElement result) => new(result, null);
}

public static class McpPipe
{
    public const string NotInTily = "Les outils Tily ne fonctionnent que dans un terminal Tily : lancez Claude Code depuis un pane de Tily.";
    public const string NotRunning = "Tily ne répond pas : la fenêtre de Tily qui a ouvert ce terminal est fermée, ou le serveur MCP est désactivé dans Paramètres (section « Serveur MCP »).";
    public const string OtherWindow = "Ce terminal appartient à une autre fenêtre de Tily, que le serveur MCP déclaré ne sait pas joindre : dans Paramètres, section « Serveur MCP », activez-le pour cette copie de Tily, puis relancez Claude Code.";
    public const string Unreadable = "Requête MCP illisible.";
    public const string NoAnswer = "Tily a fermé la connexion sans répondre.";
    public const string UnreadableAnswer = "Réponse de Tily illisible.";

    public static readonly Encoding Utf8 = new UTF8Encoding(false);

    public static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public static byte[] Line<T>(T value) => Utf8.GetBytes(JsonSerializer.Serialize(value, JsonOptions) + "\n");

    public static T? Parse<T>(string? line) where T : class
    {
        if (string.IsNullOrWhiteSpace(line))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<T>(line, JsonOptions);
        }
        catch (JsonException)
        {
            return null;
        }
    }
}

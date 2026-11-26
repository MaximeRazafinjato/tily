using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;

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
    public const string NotRunning = "Tily ne répond pas : l’instance qui a ouvert ce terminal est fermée, ou le serveur MCP est désactivé dans Paramètres (section « Serveur MCP »).";
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

    private static readonly McpPipeJsonContext PipeContext = new(new JsonSerializerOptions(JsonOptions));

    public static byte[] Line(McpPipeRequestModel request) => Line(request, PipeContext.McpPipeRequestModel);

    public static byte[] Line(McpPipeResponseModel response) => Line(response, PipeContext.McpPipeResponseModel);

    public static McpPipeRequestModel? ParseRequest(string? line) => Parse(line, PipeContext.McpPipeRequestModel);

    public static McpPipeResponseModel? ParseResponse(string? line) => Parse(line, PipeContext.McpPipeResponseModel);

    private static byte[] Line<T>(T value, JsonTypeInfo<T> typeInfo) => Utf8.GetBytes(JsonSerializer.Serialize(value, typeInfo) + "\n");

    private static T? Parse<T>(string? line, JsonTypeInfo<T> typeInfo) where T : class
    {
        if (string.IsNullOrWhiteSpace(line))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize(line, typeInfo);
        }
        catch (JsonException)
        {
            return null;
        }
    }
}

[JsonSerializable(typeof(McpPipeRequestModel))]
[JsonSerializable(typeof(McpPipeResponseModel))]
internal sealed partial class McpPipeJsonContext : JsonSerializerContext;

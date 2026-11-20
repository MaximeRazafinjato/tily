using System.Text.Json;

namespace Tily.Core.Browser;

public sealed record BrowserPointModel(double X, double Y, string Description, int Matches);

public sealed record BrowserFieldModel(string Description, string Ref, bool Handled);

public sealed record BrowserValueModel(string? Value);

public sealed record BrowserFocusedModel(string? Focused);

public sealed record BrowserBoxModel(double Width, double Height);

public sealed record BrowserEvaluationModel(string Type, JsonElement? Value, string? Text, bool Truncated);

public static class BrowserPageResults
{
    public const int MaxEvaluationLength = 20_000;
    private const int MaxExceptionLength = 2_000;
    private const string Unreadable = "La page n’a pas rendu de réponse lisible : elle a peut-être changé pendant l’action.";
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);

    public static JsonElement Value(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        if (root.TryGetProperty("exceptionDetails", out var exception))
        {
            throw new InvalidOperationException($"Le script de Tily a échoué dans la page : {ExceptionText(exception)}");
        }

        if (!root.TryGetProperty("result", out var result) || !result.TryGetProperty("value", out var value) || value.ValueKind != JsonValueKind.Object)
        {
            throw new InvalidOperationException(Unreadable);
        }

        if (value.TryGetProperty("error", out var error) && error.GetString() is { } message)
        {
            throw new InvalidOperationException(message);
        }

        return value.Clone();
    }

    public static T Parse<T>(string json) => Value(json).Deserialize<T>(Options) ?? throw new InvalidOperationException(Unreadable);

    public static BrowserEvaluationModel Evaluation(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        if (root.TryGetProperty("exceptionDetails", out var exception))
        {
            throw new InvalidOperationException($"L’expression a levé une exception : {ExceptionText(exception)}");
        }

        var result = root.GetProperty("result");
        var type = result.TryGetProperty("subtype", out var subtype) ? subtype.GetString() ?? string.Empty : result.GetProperty("type").GetString() ?? string.Empty;
        if (result.TryGetProperty("value", out var value))
        {
            var raw = value.GetRawText();
            return raw.Length > MaxEvaluationLength
                ? new BrowserEvaluationModel(type, null, raw[..MaxEvaluationLength], true)
                : new BrowserEvaluationModel(type, value.Clone(), null, false);
        }

        var text = result.TryGetProperty("unserializableValue", out var unserializable) ? unserializable.GetString()
            : result.TryGetProperty("description", out var description) ? description.GetString()
            : null;
        return new BrowserEvaluationModel(type, null, text, false);
    }

    private static string ExceptionText(JsonElement details)
    {
        var text = details.TryGetProperty("exception", out var exception) && exception.TryGetProperty("description", out var description)
            ? description.GetString()
            : details.TryGetProperty("text", out var summary) ? summary.GetString() : null;
        var message = string.IsNullOrWhiteSpace(text) ? "erreur inconnue" : text.Trim();
        return message.Length > MaxExceptionLength ? message[..MaxExceptionLength] : message;
    }
}

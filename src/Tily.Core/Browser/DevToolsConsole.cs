using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Tily.Core.Browser;

public static partial class DevToolsConsole
{
    public const string ConsoleApiCalled = "Runtime.consoleAPICalled";
    public const string ExceptionThrown = "Runtime.exceptionThrown";
    public const string EntryAdded = "Log.entryAdded";
    private const int MaxPreviewProperties = 8;

    public static BrowserConsoleMessageModel? Parse(string eventName, string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        return eventName switch
        {
            ConsoleApiCalled => FromConsoleCall(root),
            ExceptionThrown => FromException(root),
            EntryAdded => FromLogEntry(root),
            _ => null
        };
    }

    private static BrowserConsoleMessageModel? FromConsoleCall(JsonElement root)
    {
        var type = String(root, "type") ?? "log";
        if (type is "endGroup" or "clear")
        {
            return null;
        }

        var arguments = root.TryGetProperty("args", out var args) && args.ValueKind == JsonValueKind.Array ? args.EnumerateArray().ToList() : [];
        var frame = FirstFrame(root);
        return new BrowserConsoleMessageModel(LevelOfConsoleType(type), Format(arguments), String(frame, "url"), Line(frame));
    }

    private static BrowserConsoleMessageModel FromException(JsonElement root)
    {
        var details = root.GetProperty("exceptionDetails");
        var text = String(details, "text") ?? "Uncaught";
        var description = details.TryGetProperty("exception", out var exception) ? String(exception, "description") ?? Describe(exception) : null;
        var message = description is null || text.Contains(description, StringComparison.Ordinal) ? text : $"{text} {description}";
        return new BrowserConsoleMessageModel(BrowserLogLevel.Error, message, String(details, "url"), Line(details));
    }

    private static BrowserConsoleMessageModel? FromLogEntry(JsonElement root)
    {
        var entry = root.GetProperty("entry");
        if (String(entry, "source") == "network")
        {
            return null;
        }

        var level = String(entry, "level") switch
        {
            "error" => BrowserLogLevel.Error,
            "warning" => BrowserLogLevel.Warn,
            "verbose" => BrowserLogLevel.Debug,
            _ => BrowserLogLevel.Log
        };
        return new BrowserConsoleMessageModel(level, String(entry, "text") ?? string.Empty, String(entry, "url"), Line(entry));
    }

    public static BrowserLogLevel LevelOfConsoleType(string type) => type switch
    {
        "error" or "assert" => BrowserLogLevel.Error,
        "warning" => BrowserLogLevel.Warn,
        "debug" => BrowserLogLevel.Debug,
        _ => BrowserLogLevel.Log
    };

    public static string Format(IReadOnlyList<JsonElement> arguments)
    {
        if (arguments.Count == 0)
        {
            return string.Empty;
        }

        var parts = new List<string>();
        var next = 1;
        if (String(arguments[0], "type") == "string" && String(arguments[0], "value") is { } template && template.Contains('%'))
        {
            parts.Add(Substitute(template, arguments, ref next));
        }
        else
        {
            next = 0;
        }

        parts.AddRange(arguments.Skip(next).Select(Describe));
        return string.Join(' ', parts.Where(part => part.Length > 0));
    }

    private static string Substitute(string template, IReadOnlyList<JsonElement> arguments, ref int next)
    {
        var builder = new StringBuilder();
        var index = next;
        var last = 0;
        foreach (Match match in Placeholder().Matches(template))
        {
            builder.Append(template, last, match.Index - last);
            last = match.Index + match.Length;
            if (match.Value == "%%")
            {
                builder.Append('%');
                continue;
            }

            if (index >= arguments.Count)
            {
                builder.Append(match.Value);
                continue;
            }

            var argument = arguments[index++];
            if (match.Value != "%c")
            {
                builder.Append(Describe(argument));
            }
        }

        builder.Append(template, last, template.Length - last);
        next = index;
        return builder.ToString();
    }

    public static string Describe(JsonElement value)
    {
        var type = String(value, "type");
        if (value.TryGetProperty("unserializableValue", out var unserializable))
        {
            return unserializable.ToString();
        }

        if (type == "undefined")
        {
            return "undefined";
        }

        if (String(value, "subtype") == "null")
        {
            return "null";
        }

        if (value.TryGetProperty("value", out var primitive) && type is "string" or "number" or "boolean" or "bigint")
        {
            return primitive.ValueKind == JsonValueKind.String ? primitive.GetString() ?? string.Empty : primitive.GetRawText();
        }

        if (type == "object" && value.TryGetProperty("preview", out var preview) && String(value, "subtype") is not ("error" or "node"))
        {
            return Preview(preview);
        }

        return String(value, "description") ?? type ?? string.Empty;
    }

    private static string Preview(JsonElement preview)
    {
        var array = String(preview, "subtype") == "array";
        var properties = preview.TryGetProperty("properties", out var list) && list.ValueKind == JsonValueKind.Array ? list.EnumerateArray().Take(MaxPreviewProperties).ToList() : [];
        var items = properties.Select(property => array ? PreviewValue(property) : $"{String(property, "name")}: {PreviewValue(property)}").ToList();
        if (preview.TryGetProperty("overflow", out var overflow) && overflow.ValueKind == JsonValueKind.True)
        {
            items.Add("…");
        }

        return array ? $"[{string.Join(", ", items)}]" : $"{{{string.Join(", ", items)}}}";
    }

    private static string PreviewValue(JsonElement property)
    {
        var value = String(property, "value") ?? string.Empty;
        return String(property, "type") == "string" ? $"\"{value}\"" : value;
    }

    private static JsonElement FirstFrame(JsonElement root) =>
        root.TryGetProperty("stackTrace", out var stack) && stack.TryGetProperty("callFrames", out var frames) && frames.ValueKind == JsonValueKind.Array && frames.GetArrayLength() > 0
            ? frames[0]
            : default;

    private static int? Line(JsonElement element) =>
        element.ValueKind == JsonValueKind.Object && element.TryGetProperty("lineNumber", out var line) && line.TryGetInt32(out var number) ? number + 1 : null;

    private static string? String(JsonElement element, string name) =>
        element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out var property)
            ? property.ValueKind switch
            {
                JsonValueKind.String => property.GetString(),
                JsonValueKind.Number => property.GetRawText(),
                JsonValueKind.True or JsonValueKind.False => property.GetRawText(),
                _ => null
            }
            : null;

    [GeneratedRegex("%[sdifoOc%]", RegexOptions.CultureInvariant)]
    private static partial Regex Placeholder();
}

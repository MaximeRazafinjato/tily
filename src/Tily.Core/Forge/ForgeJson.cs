using System.Globalization;
using System.Text.Json;

namespace Tily.Core.Forge;

internal static class ForgeJson
{
    public static IReadOnlyList<MergeRequestModel> ParseArray(string json, string host, Func<JsonElement, MergeRequestModel> read)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            if (document.RootElement.ValueKind != JsonValueKind.Array)
            {
                throw new ForgeException($"Réponse de {host} illisible.");
            }

            return document.RootElement.EnumerateArray().Select(read).OrderByDescending(item => item.UpdatedAt).ToList();
        }
        catch (JsonException)
        {
            throw new ForgeException($"Réponse de {host} illisible.");
        }
        catch (InvalidOperationException)
        {
            throw new ForgeException($"Réponse de {host} illisible.");
        }
    }

    public static string Text(JsonElement element, string name) =>
        element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() ?? string.Empty : string.Empty;

    public static bool Flag(JsonElement element, string name) =>
        element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.True;

    public static int Number(JsonElement element, string name) =>
        element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Number ? value.GetInt32() : 0;

    public static DateTimeOffset Date(JsonElement element, string name) =>
        DateTimeOffset.TryParse(Text(element, name), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var date) ? date : DateTimeOffset.MinValue;

    public static IEnumerable<JsonElement> Items(JsonElement element, string name) =>
        element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Array ? value.EnumerateArray() : [];

    public static ForgeUserModel User(JsonElement element, string loginProperty)
    {
        if (element.ValueKind != JsonValueKind.Object)
        {
            return new ForgeUserModel(string.Empty, string.Empty);
        }

        var login = Text(element, loginProperty);
        var name = Text(element, "name");
        return new ForgeUserModel(login, name.Length == 0 ? login : name);
    }
}

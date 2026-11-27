using System.Text.Json;
using System.Text.Json.Nodes;
using ModelContextProtocol.Protocol;
using Tily.Core.Browser;
using Tily.Core.Mcp;

namespace Tily.Mcp;

internal static class TilyConnection
{
    public static async Task<CallToolResult> CallAsync(string tool, JsonObject? arguments, CancellationToken token)
    {
        var response = await SendAsync(tool, arguments, token);
        if (response.Error is { } error)
        {
            return Failure(error);
        }

        var text = response.Result is { } result ? JsonSerializer.Serialize(result, TilyJsonContext.Pipe.JsonElement) : McpPipe.UnreadableAnswer;
        return new CallToolResult { Content = [new TextContentBlock { Text = text }], IsError = response.Result is null };
    }

    public static async Task<McpPipeResponseModel> SendAsync(string tool, JsonObject? arguments, CancellationToken token)
    {
        var pane = McpEndpoint.PaneFromEnvironment();
        if (pane is null)
        {
            return McpPipeResponseModel.Failure(McpPipe.NotInTily);
        }

        var pipe = McpEndpoint.PipeName(McpEndpoint.DataDirectoryFromEnvironment());
        var element = arguments is null ? (JsonElement?)null : Element(arguments);
        return await McpPipeClient.SendAsync(pipe, new McpPipeRequestModel(tool, pane, element), McpPipeClient.ConnectTimeout, token);
    }

    public static Task<CallToolResult> CallCheckedAsync(string tool, Func<JsonObject> arguments, CancellationToken token)
    {
        JsonObject values;
        try
        {
            values = arguments();
        }
        catch (InvalidOperationException exception)
        {
            return Task.FromResult(Failure(exception.Message));
        }

        return CallAsync(tool, values, token);
    }

    public static CallToolResult Failure(string message) =>
        new() { Content = [new TextContentBlock { Text = message }], IsError = true };

    public static JsonNode? Node(BrowserTargetModel? target) => JsonSerializer.SerializeToNode(target, TilyJsonContext.Pipe.BrowserTargetModel);

    private static JsonElement Element(JsonObject arguments)
    {
        foreach (var name in arguments.Where(property => property.Value is null).Select(property => property.Key).ToList())
        {
            arguments.Remove(name);
        }

        return JsonSerializer.SerializeToElement(arguments, TilyJsonContext.Pipe.JsonObject);
    }
}

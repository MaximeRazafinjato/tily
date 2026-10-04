using System.Text.Json;
using ModelContextProtocol.Protocol;
using Tily.Core.Mcp;

namespace Tily.Mcp;

internal static class TilyConnection
{
    public static async Task<CallToolResult> CallAsync(string tool, object? arguments, CancellationToken token)
    {
        var response = await SendAsync(tool, arguments, token);
        if (response.Error is { } error)
        {
            return Failure(error);
        }

        var text = response.Result is { } result ? JsonSerializer.Serialize(result, McpPipe.JsonOptions) : McpPipe.UnreadableAnswer;
        return new CallToolResult { Content = [new TextContentBlock { Text = text }], IsError = response.Result is null };
    }

    public static async Task<McpPipeResponseModel> SendAsync(string tool, object? arguments, CancellationToken token)
    {
        var pane = McpEndpoint.PaneFromEnvironment();
        if (pane is null)
        {
            return McpPipeResponseModel.Failure(McpPipe.NotInTily);
        }

        var pipe = McpEndpoint.PipeFromEnvironment();
        var element = arguments is null ? (JsonElement?)null : JsonSerializer.SerializeToElement(arguments, McpPipe.JsonOptions);
        return await McpPipeClient.SendAsync(pipe, new McpPipeRequestModel(tool, pane, element), McpPipeClient.ConnectTimeout, token);
    }

    public static Task<CallToolResult> CallCheckedAsync(string tool, Func<object> arguments, CancellationToken token)
    {
        object values;
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
}

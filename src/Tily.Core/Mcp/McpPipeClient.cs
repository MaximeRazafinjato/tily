using System.IO.Pipes;

namespace Tily.Core.Mcp;

public static class McpPipeClient
{
    private const int ReadBufferSize = 4096;
    public static readonly TimeSpan ConnectTimeout = TimeSpan.FromSeconds(3);

    public static async Task<McpPipeResponseModel> SendAsync(string pipeName, McpPipeRequestModel request, TimeSpan connectTimeout, CancellationToken token)
    {
        await using var stream = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous | PipeOptions.CurrentUserOnly);
        try
        {
            await stream.ConnectAsync(connectTimeout, token);
        }
        catch (Exception exception) when (exception is TimeoutException or IOException or UnauthorizedAccessException)
        {
            return McpPipeResponseModel.Failure(McpPipe.NotRunning);
        }

        try
        {
            await stream.WriteAsync(McpPipe.Line(request), token);
            await stream.FlushAsync(token);
            using var reader = new StreamReader(stream, McpPipe.Utf8, false, ReadBufferSize, true);
            var line = await reader.ReadLineAsync(token);
            if (line is null)
            {
                return McpPipeResponseModel.Failure(McpPipe.NoAnswer);
            }

            return McpPipe.ParseResponse(line) ?? McpPipeResponseModel.Failure(McpPipe.UnreadableAnswer);
        }
        catch (IOException)
        {
            return McpPipeResponseModel.Failure(McpPipe.NoAnswer);
        }
    }
}

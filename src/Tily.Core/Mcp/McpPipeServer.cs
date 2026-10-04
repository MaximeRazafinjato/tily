using System.IO.Pipes;
using Tily.Core.StatusLog;

namespace Tily.Core.Mcp;

public sealed class McpPipeServer : IDisposable
{
    private const int ReadBufferSize = 4096;

    private readonly string _pipeName;
    private readonly Func<McpPipeRequestModel, CancellationToken, Task<McpPipeResponseModel>> _handle;
    private readonly CancellationTokenSource _stop = new();
    private NamedPipeServerStream? _waiting;

    public McpPipeServer(string pipeName, Func<McpPipeRequestModel, CancellationToken, Task<McpPipeResponseModel>> handle)
    {
        _pipeName = pipeName;
        _handle = handle;
    }

    public void Start()
    {
        NamedPipeServerStream first;
        try
        {
            first = Create(PipeOptions.FirstPipeInstance);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            throw new InvalidOperationException("Serveur MCP indisponible : une autre fenêtre de Tily utilise déjà ce canal.", exception);
        }

        _ = AcceptAsync(first);
    }

    private NamedPipeServerStream Create(PipeOptions extra) =>
        new(_pipeName, PipeDirection.InOut, NamedPipeServerStream.MaxAllowedServerInstances, PipeTransmissionMode.Byte, PipeOptions.Asynchronous | PipeOptions.CurrentUserOnly | extra);

    private async Task AcceptAsync(NamedPipeServerStream first)
    {
        var token = _stop.Token;
        NamedPipeServerStream? pending = first;
        while (pending is not null)
        {
            _waiting = pending;
            if (token.IsCancellationRequested)
            {
                await pending.DisposeAsync();
                return;
            }

            try
            {
                await pending.WaitForConnectionAsync(token);
                _ = ServeAsync(pending, token);
            }
            catch (Exception exception) when (exception is OperationCanceledException or IOException or ObjectDisposedException or UnauthorizedAccessException)
            {
                await pending.DisposeAsync();
            }

            pending = token.IsCancellationRequested ? null : TryCreate();
        }
    }

    private NamedPipeServerStream? TryCreate()
    {
        try
        {
            return Create(PipeOptions.None);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or ObjectDisposedException)
        {
            return null;
        }
    }

    private async Task ServeAsync(NamedPipeServerStream stream, CancellationToken token)
    {
        await using (stream)
        {
            try
            {
                using var reader = new StreamReader(stream, McpPipe.Utf8, false, ReadBufferSize, true);
                var line = await reader.ReadLineAsync(token);
                var response = await RespondAsync(McpPipe.Parse<McpPipeRequestModel>(line), token);
                await stream.WriteAsync(McpPipe.Line(response), token);
                await stream.FlushAsync(token);
                stream.WaitForPipeDrain();
            }
            catch (Exception exception) when (exception is IOException or OperationCanceledException or ObjectDisposedException)
            {
            }
        }
    }

    private async Task<McpPipeResponseModel> RespondAsync(McpPipeRequestModel? request, CancellationToken token)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.Tool))
        {
            return McpPipeResponseModel.Failure(McpPipe.Unreadable);
        }

        try
        {
            return await _handle(request, token);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            return McpPipeResponseModel.Failure(UserErrorMessage.Of(exception));
        }
    }

    public void Dispose()
    {
        _stop.Cancel();
        _waiting?.Dispose();
    }
}

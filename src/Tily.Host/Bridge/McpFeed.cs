using System.Collections.Concurrent;
using Tily.Core.Context;
using Tily.Core.Mcp;
using Tily.Core.StatusLog;

namespace Tily.Host.Bridge;

public sealed class McpFeed : IDisposable
{
    private static readonly TimeSpan AnswerTimeout = TimeSpan.FromSeconds(10);
    private const string Starting = "Tily démarre encore : réessayez dans un instant.";

    private readonly string _pipeName;
    private readonly string _legacyPipeName;
    private readonly Func<string, bool> _ownsPane;
    private readonly Action<object> _post;
    private readonly Action<Exception> _fail;
    private readonly ConcurrentDictionary<string, TaskCompletionSource<McpPipeResponseModel>> _pending = new();
    private readonly object _serverLock = new();
    private McpPipeServer? _server;
    private McpPipeServer? _legacyServer;
    private ClaudeMcpStatusModel? _status;
    private string? _error;
    private volatile bool _ready;

    public McpFeed(string pipeName, string legacyPipeName, Func<string, bool> ownsPane, Action<object> post, Action<Exception> fail)
    {
        _pipeName = pipeName;
        _legacyPipeName = legacyPipeName;
        _ownsPane = ownsPane;
        _post = post;
        _fail = fail;
        Installer = new ClaudeMcpInstaller(Path.Combine(AppContext.BaseDirectory, ClaudeMcpInstaller.ExecutableName));
    }

    public ClaudeMcpInstaller Installer { get; }

    public void Start() => Task.Run(() =>
    {
        try
        {
            Apply(Installer.Status());
        }
        catch (Exception exception) when (exception is InvalidOperationException or IOException or UnauthorizedAccessException)
        {
            _error = UserErrorMessage.Of(exception);
            _fail(exception);
        }
    });

    public void MarkReady() => _ready = true;

    public void Install() => Apply(Installer.Install());

    public void Remove() => Apply(Installer.Remove());

    public object Describe() => new
    {
        configFile = Installer.ConfigFile,
        executable = Installer.ExecutablePath,
        available = File.Exists(Installer.ExecutablePath),
        installed = _status?.Installed ?? false,
        command = _status?.Command,
        listening = _server is not null,
        error = _error
    };

    public void Receive(BridgeCommandModel command)
    {
        if (command.Type != "mcp.response" || command.Id is not { } id || !_pending.TryRemove(id, out var answer))
        {
            return;
        }

        answer.TrySetResult(command.Error is { } error
            ? McpPipeResponseModel.Failure(error)
            : command.Result is { } result ? McpPipeResponseModel.Success(result) : McpPipeResponseModel.Failure(McpPipe.UnreadableAnswer));
    }

    private void Apply(ClaudeMcpStatusModel status)
    {
        _status = status;
        lock (_serverLock)
        {
            if (status.Installed && _server is null)
            {
                var server = new McpPipeServer(_pipeName, HandleAsync);
                try
                {
                    server.Start();
                    _server = server;
                    _error = null;
                }
                catch (InvalidOperationException exception)
                {
                    server.Dispose();
                    _error = exception.Message;
                }

                _legacyServer = TryStart(_legacyPipeName);
            }
            else if (!status.Installed && _server is not null)
            {
                StopServers();
                _error = null;
            }
        }
    }

    private McpPipeServer? TryStart(string pipeName)
    {
        var server = new McpPipeServer(pipeName, HandleAsync);
        try
        {
            server.Start();
            return server;
        }
        catch (InvalidOperationException)
        {
            server.Dispose();
            return null;
        }
    }

    private void StopServers()
    {
        _server?.Dispose();
        _server = null;
        _legacyServer?.Dispose();
        _legacyServer = null;
    }

    private async Task<McpPipeResponseModel> HandleAsync(McpPipeRequestModel request, CancellationToken token)
    {
        if (!_ready)
        {
            return McpPipeResponseModel.Failure(Starting);
        }

        if (request.Pane is not { } pane || !_ownsPane(pane))
        {
            return McpPipeResponseModel.Failure(McpPipe.OtherWindow);
        }

        var id = Guid.NewGuid().ToString("N");
        var answer = new TaskCompletionSource<McpPipeResponseModel>(TaskCreationOptions.RunContinuationsAsynchronously);
        _pending[id] = answer;
        McpPipeResponseModel response;
        try
        {
            _post(new { type = "mcp.request", id, tool = request.Tool, pane = request.Pane, arguments = request.Arguments });
            response = await answer.Task.WaitAsync(AnswerTimeoutOf(request), token);
        }
        catch (TimeoutException)
        {
            return McpPipeResponseModel.Failure($"Tily n’a pas répondu à temps à la demande « {request.Tool} ».");
        }
        finally
        {
            _pending.TryRemove(id, out _);
        }

        return request.Tool == McpLayout.Tool && response.Result is { } layout
            ? McpPipeResponseModel.Success(McpLayout.WithBranches(layout, GitContext.Resolve))
            : response;
    }

    private static TimeSpan AnswerTimeoutOf(McpPipeRequestModel request) => request.Tool switch
    {
        McpWaitFor.Tool => McpWaitFor.AnswerTimeout(request.Arguments),
        var tool when McpActions.MayAskConsent(tool) => McpActions.ConsentAnswerTimeout,
        var tool when McpWorktrees.IsLongOperation(tool) => McpWorktrees.OperationAnswerTimeout,
        var tool when McpBrowser.IsLong(tool) => McpBrowser.AnswerTimeout,
        _ => AnswerTimeout
    };

    public void Dispose()
    {
        lock (_serverLock)
        {
            StopServers();
        }

        foreach (var answer in _pending.Values)
        {
            answer.TrySetResult(McpPipeResponseModel.Failure(McpPipe.NoAnswer));
        }
    }
}

using System.Text.Json;
using Tily.Core.Mcp;
using Xunit;

namespace Tily.Core.Tests.Mcp;

public sealed class McpPipeTests : IDisposable
{
    private static readonly TimeSpan Connect = TimeSpan.FromSeconds(2);
    private static readonly TimeSpan ShortConnect = TimeSpan.FromMilliseconds(300);

    private readonly string _pipeName = "tily-mcp-test-" + Guid.NewGuid().ToString("N");
    private readonly List<McpPipeServer> _servers = [];

    [Fact]
    public async Task SendAsync_WhenServerAnswers_ThenClientReceivesResultAndPane()
    {
        Serve((request, _) => Task.FromResult(McpPipeResponseModel.Success(JsonSerializer.SerializeToElement(new { tool = request.Tool, pane = request.Pane }))));

        var response = await SendAsync("pane-1", Connect);

        Assert.Null(response.Error);
        Assert.Equal("pane-1", response.Result!.Value.GetProperty("pane").GetString());
    }

    [Fact]
    public async Task SendAsync_WhenRequestsOverlap_ThenEachGetsItsOwnAnswer()
    {
        Serve(async (request, token) =>
        {
            await Task.Delay(request.Pane == "lent" ? 300 : 0, token);
            return McpPipeResponseModel.Success(JsonSerializer.SerializeToElement(request.Pane));
        });

        var answers = await Task.WhenAll(SendAsync("lent", Connect), SendAsync("rapide", Connect));

        Assert.Equal(["lent", "rapide"], answers.Select(answer => answer.Result!.Value.GetString()).ToList());
    }

    [Fact]
    public async Task SendAsync_WhenHandlerThrows_ThenErrorInFrench()
    {
        Serve((_, _) => throw new InvalidOperationException("Pane inconnu."));

        var response = await SendAsync("pane-1", Connect);

        Assert.Equal("Pane inconnu.", response.Error);
    }

    [Fact]
    public async Task SendAsync_WhenNoServer_ThenTilyNotRunning()
    {
        var response = await SendAsync("pane-1", ShortConnect);

        Assert.Equal(McpPipe.NotRunning, response.Error);
    }

    [Fact]
    public async Task SendAsync_WhenServerDisposed_ThenTilyNotRunning()
    {
        var server = Serve((_, _) => Task.FromResult(McpPipeResponseModel.Failure("jamais")));
        server.Dispose();

        var response = await SendAsync("pane-1", ShortConnect);

        Assert.Equal(McpPipe.NotRunning, response.Error);
    }

    [Fact]
    public void Start_WhenAnotherServerOwnsTheName_ThenFailsInFrench()
    {
        Serve((_, _) => Task.FromResult(McpPipeResponseModel.Failure("premier")));
        var second = new McpPipeServer(_pipeName, (_, _) => Task.FromResult(McpPipeResponseModel.Failure("second")));
        _servers.Add(second);

        var error = Assert.Throws<InvalidOperationException>(second.Start);

        Assert.Contains("une autre fenêtre de Tily", error.Message);
    }

    private Task<McpPipeResponseModel> SendAsync(string pane, TimeSpan connect) =>
        McpPipeClient.SendAsync(_pipeName, new McpPipeRequestModel("layout", pane, null), connect, CancellationToken.None);

    private McpPipeServer Serve(Func<McpPipeRequestModel, CancellationToken, Task<McpPipeResponseModel>> handle)
    {
        var server = new McpPipeServer(_pipeName, handle);
        _servers.Add(server);
        server.Start();
        return server;
    }

    public void Dispose()
    {
        foreach (var server in _servers)
        {
            server.Dispose();
        }
    }
}

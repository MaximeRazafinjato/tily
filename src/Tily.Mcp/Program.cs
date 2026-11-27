using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;
using Tily.Core.Mcp;
using Tily.Mcp;

var inTily = McpEndpoint.PaneFromEnvironment() is not null;
var options = new McpServerOptions
{
    ServerInfo = new Implementation { Name = TilyTools.ServerName, Title = "Tily", Version = TilyTools.Version },
    ServerInstructions = inTily ? TilyTools.Instructions : null,
    ToolCollection = inTily ? TilyTools.Collection() : []
};
ReleaseToolCreationMemory();

await using var server = McpServer.Create(new StdioServerTransport(TilyTools.ServerName), options);
await server.RunAsync();

static void ReleaseToolCreationMemory() => GC.Collect(GC.MaxGeneration, GCCollectionMode.Aggressive, true, true);

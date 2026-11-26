using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using Tily.Core.Browser;
using Tily.Core.Mcp;

namespace Tily.Mcp;

[JsonSerializable(typeof(JsonObject))]
[JsonSerializable(typeof(JsonElement))]
[JsonSerializable(typeof(BrowserTargetModel))]
internal sealed partial class TilyJsonContext : JsonSerializerContext
{
    public static readonly TilyJsonContext Pipe = new(new JsonSerializerOptions(McpPipe.JsonOptions));
}

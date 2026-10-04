using System.Text.Json;

namespace Tily.Core.Browser;

public sealed record DevToolsNetworkEventModel(BrowserNetworkEntryModel Entry, string RequestId, bool NeedsBody);

public sealed class DevToolsNetwork
{
    public const string RequestWillBeSent = "Network.requestWillBeSent";
    public const string ResponseReceived = "Network.responseReceived";
    public const string LoadingFinished = "Network.loadingFinished";
    public const string LoadingFailed = "Network.loadingFailed";
    public static readonly string[] Events = [RequestWillBeSent, ResponseReceived, LoadingFinished, LoadingFailed];
    public const int MaxPending = 1000;
    private const string DataScheme = "data:";
    private const string Canceled = "net::ERR_ABORTED";

    private readonly Dictionary<string, PendingRequest> _pending = new();
    private readonly Queue<string> _order = new();

    public int PendingCount => _pending.Count;

    public DevToolsNetworkEventModel? Handle(string eventName, string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        var requestId = Text(root, "requestId");
        if (requestId is null)
        {
            return null;
        }

        return eventName switch
        {
            RequestWillBeSent => Start(requestId, root),
            ResponseReceived => Respond(requestId, root),
            LoadingFinished => Finish(requestId, root),
            LoadingFailed => Fail(requestId, root),
            _ => null
        };
    }

    public static string? BodyOf(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        var body = Text(root, "body");
        if (body is null)
        {
            return null;
        }

        return root.TryGetProperty("base64Encoded", out var encoded) && encoded.ValueKind == JsonValueKind.True ? $"(contenu binaire, {body.Length * 3 / 4} octets)" : body;
    }

    private DevToolsNetworkEventModel? Start(string requestId, JsonElement root)
    {
        DevToolsNetworkEventModel? redirected = null;
        if (root.TryGetProperty("redirectResponse", out var redirect) && _pending.Remove(requestId, out var previous))
        {
            previous.Apply(redirect);
            redirected = Complete(requestId, previous, Number(root, "timestamp"), false, null);
        }

        var request = root.GetProperty("request");
        var url = Text(request, "url") ?? string.Empty;
        if (url.StartsWith(DataScheme, StringComparison.OrdinalIgnoreCase))
        {
            return redirected;
        }

        Track(requestId, new PendingRequest(Text(request, "method") ?? "GET", url, Text(root, "type"), Number(root, "timestamp")));
        return redirected;
    }

    private DevToolsNetworkEventModel? Respond(string requestId, JsonElement root)
    {
        if (_pending.TryGetValue(requestId, out var pending) && root.TryGetProperty("response", out var response))
        {
            pending.Apply(response);
            pending.Type ??= Text(root, "type");
        }

        return null;
    }

    private DevToolsNetworkEventModel? Finish(string requestId, JsonElement root) =>
        _pending.Remove(requestId, out var pending) ? Complete(requestId, pending, Number(root, "timestamp"), false, null) : null;

    private DevToolsNetworkEventModel? Fail(string requestId, JsonElement root)
    {
        if (!_pending.Remove(requestId, out var pending))
        {
            return null;
        }

        var canceled = root.TryGetProperty("canceled", out var flag) && flag.ValueKind == JsonValueKind.True;
        var error = Text(root, "errorText");
        var blocked = Text(root, "blockedReason");
        var label = canceled || error == Canceled ? "annulée" : blocked is null ? error : $"{error} (bloquée : {blocked})";
        return Complete(requestId, pending, Number(root, "timestamp"), !(canceled || error == Canceled), label);
    }

    private static DevToolsNetworkEventModel Complete(string requestId, PendingRequest pending, double? finished, bool failed, string? error)
    {
        var duration = finished is { } end && pending.Started is { } start && end >= start ? Math.Round((end - start) * 1000, 1) : (double?)null;
        var entry = new BrowserNetworkEntryModel(0, default, pending.Method, pending.Url, pending.Type, pending.Status, pending.StatusText, pending.MimeType, duration, failed, error, null, 0);
        return new DevToolsNetworkEventModel(entry, requestId, !failed && error is null && pending.Status >= 400);
    }

    private void Track(string requestId, PendingRequest request)
    {
        _pending[requestId] = request;
        _order.Enqueue(requestId);
        while (_pending.Count > MaxPending && _order.TryDequeue(out var oldest))
        {
            _pending.Remove(oldest);
        }

        if (_order.Count > MaxPending * 4)
        {
            var live = _order.Where(_pending.ContainsKey).Distinct().ToList();
            _order.Clear();
            live.ForEach(_order.Enqueue);
        }
    }

    private static string? Text(JsonElement element, string name) =>
        element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    private static double? Number(JsonElement element, string name) =>
        element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out var value) && value.TryGetDouble(out var number) ? number : null;

    private sealed class PendingRequest(string method, string url, string? type, double? started)
    {
        public string Method { get; } = method;
        public string Url { get; } = url;
        public string? Type { get; set; } = type;
        public double? Started { get; } = started;
        public int? Status { get; private set; }
        public string? StatusText { get; private set; }
        public string? MimeType { get; private set; }

        public void Apply(JsonElement response)
        {
            Status = response.TryGetProperty("status", out var status) && status.TryGetInt32(out var code) ? code : Status;
            StatusText = Text(response, "statusText") is { Length: > 0 } text ? text : StatusText;
            MimeType = Text(response, "mimeType") ?? MimeType;
        }
    }
}

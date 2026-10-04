using Tily.Core.Browser;
using Xunit;

namespace Tily.Core.Tests.Browser;

public sealed class DevToolsNetworkTests
{
    private static string Sent(string id, string url, double timestamp, string method = "GET") =>
        $$"""{"requestId":"{{id}}","request":{"url":"{{url}}","method":"{{method}}"},"timestamp":{{timestamp.ToString(System.Globalization.CultureInfo.InvariantCulture)}},"type":"Fetch"}""";

    private static string Received(string id, int status, string statusText = "OK") =>
        $$$"""{"requestId":"{{{id}}}","type":"Fetch","response":{"status":{{{status}}},"statusText":"{{{statusText}}}","mimeType":"application/json"}}""";

    private static string Finished(string id, double timestamp) =>
        $$"""{"requestId":"{{id}}","timestamp":{{timestamp.ToString(System.Globalization.CultureInfo.InvariantCulture)}},"encodedDataLength":120}""";

    [Fact]
    public void Handle_WhenRequestFinishesWithError_ThenEntryWithDurationAndBodyNeeded()
    {
        var network = new DevToolsNetwork();
        network.Handle(DevToolsNetwork.RequestWillBeSent, Sent("1", "http://localhost:5871/api/fail", 10.0, "POST"));
        network.Handle(DevToolsNetwork.ResponseReceived, Received("1", 500, "Internal Server Error"));

        var finished = network.Handle(DevToolsNetwork.LoadingFinished, Finished("1", 10.1319));

        Assert.Equal(
            (true, "POST", 500, "Internal Server Error", "application/json", 131.9, false),
            (finished!.NeedsBody, finished.Entry.Method, finished.Entry.Status, finished.Entry.StatusText, finished.Entry.MimeType, finished.Entry.DurationMs, finished.Entry.Failed));
    }

    [Fact]
    public void Handle_WhenRequestSucceeds_ThenNoBodyNeeded()
    {
        var network = new DevToolsNetwork();
        network.Handle(DevToolsNetwork.RequestWillBeSent, Sent("1", "http://localhost:5871/api/ok", 1));
        network.Handle(DevToolsNetwork.ResponseReceived, Received("1", 200));

        var finished = network.Handle(DevToolsNetwork.LoadingFinished, Finished("1", 1.01));

        Assert.False(finished!.NeedsBody);
    }

    [Fact]
    public void Handle_WhenLoadingFails_ThenFailedWithError()
    {
        var network = new DevToolsNetwork();
        network.Handle(DevToolsNetwork.RequestWillBeSent, Sent("2", "http://127.0.0.1:9/down", 1));

        var finished = network.Handle(DevToolsNetwork.LoadingFailed, """{"requestId":"2","timestamp":1.02,"type":"Fetch","errorText":"net::ERR_CONNECTION_REFUSED","canceled":false}""");

        Assert.Equal((true, "net::ERR_CONNECTION_REFUSED", true), (finished!.Entry.Failed, finished.Entry.Error, finished.Entry.IsError));
    }

    [Fact]
    public void Handle_WhenRequestCanceled_ThenNotAnError()
    {
        var network = new DevToolsNetwork();
        network.Handle(DevToolsNetwork.RequestWillBeSent, Sent("3", "http://localhost:5871/api/slow", 1));

        var finished = network.Handle(DevToolsNetwork.LoadingFailed, """{"requestId":"3","timestamp":1.5,"errorText":"net::ERR_ABORTED","canceled":true}""");

        Assert.Equal((false, "annulée"), (finished!.Entry.IsError, finished.Entry.Error));
    }

    [Fact]
    public void Handle_WhenRedirected_ThenRedirectHopRecordedAndNewRequestTracked()
    {
        var network = new DevToolsNetwork();
        network.Handle(DevToolsNetwork.RequestWillBeSent, Sent("4", "http://localhost:5871/ancien", 1));

        var hop = network.Handle(DevToolsNetwork.RequestWillBeSent, """{"requestId":"4","request":{"url":"http://localhost:5871/nouveau","method":"GET"},"timestamp":1.01,"redirectResponse":{"status":302,"statusText":"Found"}}""");
        var final = network.Handle(DevToolsNetwork.LoadingFinished, Finished("4", 1.02));

        Assert.Equal(("http://localhost:5871/ancien", 302, "http://localhost:5871/nouveau"), (hop!.Entry.Url, hop.Entry.Status, final!.Entry.Url));
    }

    [Fact]
    public void Handle_WhenDataUrl_ThenIgnored()
    {
        var network = new DevToolsNetwork();
        network.Handle(DevToolsNetwork.RequestWillBeSent, Sent("5", "data:image/png;base64,AAAA", 1));

        var finished = network.Handle(DevToolsNetwork.LoadingFinished, Finished("5", 1.1));

        Assert.Null(finished);
    }

    [Fact]
    public void Handle_WhenTooManyPendingRequests_ThenOldestForgotten()
    {
        var network = new DevToolsNetwork();
        for (var index = 0; index <= DevToolsNetwork.MaxPending; index++)
        {
            network.Handle(DevToolsNetwork.RequestWillBeSent, Sent($"r{index}", $"http://localhost/{index}", 1));
        }

        var forgotten = network.Handle(DevToolsNetwork.LoadingFinished, Finished("r0", 2));

        Assert.Equal((DevToolsNetwork.MaxPending, (DevToolsNetworkEventModel?)null), (network.PendingCount, forgotten));
    }

    [Theory]
    [InlineData("""{"body":"{\"error\":\"boum\"}","base64Encoded":false}""", "{\"error\":\"boum\"}")]
    [InlineData("""{"body":"AAAAAAAA","base64Encoded":true}""", "(contenu binaire, 6 octets)")]
    public void BodyOf_WhenResponseBody_ThenTextOrBinaryLabel(string json, string expected)
    {
        var body = DevToolsNetwork.BodyOf(json);

        Assert.Equal(expected, body);
    }
}

using Tily.Core.Browser;
using Xunit;

namespace Tily.Core.Tests.Browser;

public sealed class BrowserLogTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 4, 23, 0, 0, TimeSpan.FromHours(2));

    private static BrowserLog NewLog() => new(() => Now);

    private static BrowserNetworkEntryModel Request(string url, int? status, bool failed = false) =>
        new(0, default, "GET", url, "Fetch", status, null, null, 12, failed, failed ? "net::ERR_CONNECTION_REFUSED" : null, null, 0);

    [Fact]
    public void Console_WhenMinimumLevelWarn_ThenWarningsAndErrorsOnly()
    {
        var log = NewLog();
        log.AddConsole(new BrowserConsoleMessageModel(BrowserLogLevel.Log, "info", null, null));
        log.AddConsole(new BrowserConsoleMessageModel(BrowserLogLevel.Warn, "attention", null, null));
        log.AddConsole(new BrowserConsoleMessageModel(BrowserLogLevel.Error, "boum", null, null));

        var entries = log.Console(BrowserLogLevel.Warn, false, 50);

        Assert.Equal(["attention", "boum"], entries.Entries.Select(entry => entry.Text));
    }

    [Fact]
    public void Console_WhenSinceLoad_ThenOnlyEntriesOfLastLoad()
    {
        var log = NewLog();
        log.StartLoad();
        log.AddConsole(new BrowserConsoleMessageModel(BrowserLogLevel.Error, "avant", null, null));
        log.StartLoad();
        log.AddConsole(new BrowserConsoleMessageModel(BrowserLogLevel.Error, "après", null, null));

        var entries = log.Console(BrowserLogLevel.Debug, true, 50);

        Assert.Equal("après", Assert.Single(entries.Entries).Text);
    }

    [Fact]
    public void Console_WhenLimitBelowMatching_ThenMostRecentInOrder()
    {
        var log = NewLog();
        foreach (var text in new[] { "un", "deux", "trois" })
        {
            log.AddConsole(new BrowserConsoleMessageModel(BrowserLogLevel.Log, text, null, null));
        }

        var entries = log.Console(BrowserLogLevel.Debug, false, 2);

        Assert.Equal(("deux, trois", 3), (string.Join(", ", entries.Entries.Select(entry => entry.Text)), entries.Matching));
    }

    [Fact]
    public void AddConsole_WhenBufferFull_ThenOldestDropped()
    {
        var log = NewLog();
        for (var index = 0; index <= BrowserLog.MaxConsoleEntries; index++)
        {
            log.AddConsole(new BrowserConsoleMessageModel(BrowserLogLevel.Log, $"ligne {index}", null, null));
        }

        var entries = log.Console(BrowserLogLevel.Debug, false, BrowserLog.MaxConsoleEntries + 10);

        Assert.Equal(("ligne 1", BrowserLog.MaxConsoleEntries), (entries.Entries[0].Text, entries.Entries.Count));
    }

    [Fact]
    public void AddConsole_WhenTextTooLong_ThenTruncatedWithEllipsis()
    {
        var log = NewLog();

        var entry = log.AddConsole(new BrowserConsoleMessageModel(BrowserLogLevel.Log, new string('x', BrowserLog.MaxTextChars + 10), null, null));

        Assert.Equal(BrowserLog.MaxTextChars + 1, entry.Text.Length);
    }

    [Fact]
    public void Network_WhenFailedOnly_ThenErrorStatusesAndFailures()
    {
        var log = NewLog();
        log.AddNetwork(Request("/api/ok", 200));
        log.AddNetwork(Request("/api/missing", 404));
        log.AddNetwork(Request("/api/down", null, true));
        log.AddNetwork(Request("/redirect", 302));

        var entries = log.Network(true, false, 50);

        Assert.Equal(["/api/missing", "/api/down"], entries.Entries.Select(entry => entry.Url));
    }

    [Fact]
    public void ErrorCount_WhenErrorsBeforeAndAfterLoad_ThenOnlyCurrentLoad()
    {
        var log = NewLog();
        log.AddConsole(new BrowserConsoleMessageModel(BrowserLogLevel.Error, "ancienne", null, null));
        log.StartLoad();
        log.AddConsole(new BrowserConsoleMessageModel(BrowserLogLevel.Error, "boum", null, null));
        log.AddConsole(new BrowserConsoleMessageModel(BrowserLogLevel.Warn, "attention", null, null));
        log.AddNetwork(Request("/api/fail", 500));
        log.AddNetwork(Request("/api/ok", 200));

        var count = log.ErrorCount();

        Assert.Equal(2, count);
    }

    [Fact]
    public void ErrorCount_WhenMoreErrorsThanBufferHolds_ThenAllCounted()
    {
        var log = NewLog();
        for (var index = 0; index < BrowserLog.MaxConsoleEntries + 500; index++)
        {
            log.AddConsole(new BrowserConsoleMessageModel(BrowserLogLevel.Error, "rafale", null, null));
        }

        var count = log.ErrorCount();

        Assert.Equal(BrowserLog.MaxConsoleEntries + 500, count);
    }

    [Fact]
    public void AttachBody_WhenEntryKnown_ThenBodyTruncated()
    {
        var log = NewLog();
        var entry = log.AddNetwork(Request("/api/fail", 500));

        log.AttachBody(entry.Sequence, new string('b', BrowserLog.MaxBodyChars + 5));

        Assert.Equal(BrowserLog.MaxBodyChars + 1, log.Network(false, false, 10).Entries.Single().Body?.Length);
    }
}

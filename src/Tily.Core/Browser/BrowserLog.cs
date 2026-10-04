namespace Tily.Core.Browser;

public sealed class BrowserLog
{
    public const int MaxConsoleEntries = 1000;
    public const int MaxNetworkEntries = 500;
    public const int MaxTextChars = 4000;
    public const int MaxUrlChars = 2000;
    public const int MaxBodyChars = 2000;
    private const string Ellipsis = "…";

    private readonly object _sync = new();
    private readonly LinkedList<BrowserConsoleEntryModel> _console = new();
    private readonly LinkedList<BrowserNetworkEntryModel> _network = new();
    private readonly Func<DateTimeOffset> _clock;
    private long _sequence;
    private int _errors;

    public BrowserLog(Func<DateTimeOffset>? clock = null) => _clock = clock ?? (() => DateTimeOffset.Now);

    public int Load { get; private set; }

    public void StartLoad()
    {
        lock (_sync)
        {
            Load++;
            _errors = 0;
        }
    }

    public BrowserConsoleEntryModel AddConsole(BrowserConsoleMessageModel message)
    {
        lock (_sync)
        {
            var entry = new BrowserConsoleEntryModel(++_sequence, _clock(), message.Level, Truncate(message.Text, MaxTextChars), TruncateOrNull(message.Url, MaxUrlChars), message.Line, Load);
            Append(_console, entry, MaxConsoleEntries);
            _errors += entry.Level == BrowserLogLevel.Error ? 1 : 0;
            return entry;
        }
    }

    public BrowserNetworkEntryModel AddNetwork(BrowserNetworkEntryModel request)
    {
        lock (_sync)
        {
            var entry = request with
            {
                Sequence = ++_sequence,
                At = _clock(),
                Url = Truncate(request.Url, MaxUrlChars),
                Body = TruncateOrNull(request.Body, MaxBodyChars),
                Load = Load
            };
            Append(_network, entry, MaxNetworkEntries);
            _errors += entry.IsError ? 1 : 0;
            return entry;
        }
    }

    public void AttachBody(long sequence, string body)
    {
        lock (_sync)
        {
            for (var node = _network.Last; node is not null; node = node.Previous)
            {
                if (node.Value.Sequence == sequence)
                {
                    node.Value = node.Value with { Body = Truncate(body, MaxBodyChars) };
                    return;
                }
            }
        }
    }

    public int ErrorCount()
    {
        lock (_sync)
        {
            return _errors;
        }
    }

    public BrowserEntriesModel<BrowserConsoleEntryModel> Console(BrowserLogLevel minimum, bool sinceLoad, int limit)
    {
        lock (_sync)
        {
            return Select(_console, entry => entry.Level >= minimum && (!sinceLoad || entry.Load == Load), limit);
        }
    }

    public BrowserEntriesModel<BrowserNetworkEntryModel> Network(bool failedOnly, bool sinceLoad, int limit)
    {
        lock (_sync)
        {
            return Select(_network, entry => (!failedOnly || entry.IsError) && (!sinceLoad || entry.Load == Load), limit);
        }
    }

    private BrowserEntriesModel<T> Select<T>(IEnumerable<T> entries, Func<T, bool> keep, int limit)
    {
        var matching = entries.Where(keep).ToList();
        return new BrowserEntriesModel<T>(matching.Skip(Math.Max(0, matching.Count - limit)).ToList(), matching.Count, Load);
    }

    private static void Append<T>(LinkedList<T> entries, T entry, int capacity)
    {
        entries.AddLast(entry);
        while (entries.Count > capacity)
        {
            entries.RemoveFirst();
        }
    }

    public static string Truncate(string text, int maxChars) => text.Length <= maxChars ? text : string.Concat(text.AsSpan(0, maxChars), Ellipsis);

    private static string? TruncateOrNull(string? text, int maxChars) => text is null ? null : Truncate(text, maxChars);
}

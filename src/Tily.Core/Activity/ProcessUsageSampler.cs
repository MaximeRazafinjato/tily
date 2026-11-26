namespace Tily.Core.Activity;

public sealed class ProcessUsageSampler
{
    private const double BytesPerMegabyte = 1048576.0;

    private readonly IProcessProbe _probe;
    private readonly Func<DateTime> _clock;
    private readonly Dictionary<int, TimeSpan> _previousCpu = [];
    private DateTime _previousSample;

    public ProcessUsageSampler(IProcessProbe probe, Func<DateTime>? clock = null)
    {
        _probe = probe;
        _clock = clock ?? (() => DateTime.UtcNow);
        _previousSample = _clock();
    }

    public ActivityModel Sample(IReadOnlyDictionary<string, IReadOnlyList<int>> paneProcessIds, int hostProcessId)
    {
        var now = _clock();
        var elapsedMilliseconds = Math.Max(1, (now - _previousSample).TotalMilliseconds);
        _previousSample = now;
        var snapshot = _probe.Snapshot();
        var seen = new HashSet<int>();

        var panes = paneProcessIds
            .Select(pane => new PaneUsageModel(pane.Key, Measure(ProcessClassifier.ClassifyPane(snapshot, pane.Value), elapsedMilliseconds, seen)))
            .Where(pane => pane.Processes.Count > 0)
            .ToList();
        var paneProcesses = paneProcessIds.Values.SelectMany(ids => ids).ToHashSet();
        var host = Measure(ProcessClassifier.ClassifyHost(snapshot, hostProcessId, paneProcesses), elapsedMilliseconds, seen);

        foreach (var processId in _previousCpu.Keys.Where(processId => !seen.Contains(processId)).ToList())
        {
            _previousCpu.Remove(processId);
        }

        return new ActivityModel(panes, host);
    }

    private List<ProcessUsageModel> Measure(IEnumerable<(ProcessEntryModel Process, int Depth, string Category)> processes, double elapsedMilliseconds, HashSet<int> seen)
    {
        var usages = new List<ProcessUsageModel>();
        foreach (var (process, depth, category) in processes)
        {
            var counters = _probe.Counters(process.Id);
            if (counters is null)
            {
                continue;
            }

            seen.Add(process.Id);
            var cpu = _previousCpu.TryGetValue(process.Id, out var previous)
                ? (counters.CpuTime - previous).TotalMilliseconds / elapsedMilliseconds * 100 / Environment.ProcessorCount
                : 0;
            _previousCpu[process.Id] = counters.CpuTime;
            usages.Add(new ProcessUsageModel(process.Id, process.Name, depth, category, Math.Round(Math.Max(0, cpu), 1), Math.Round(counters.WorkingSetBytes / BytesPerMegabyte, 1)));
        }

        return usages;
    }
}

using Tily.Core.Activity;
using Xunit;

namespace Tily.Core.Tests.Activity;

public sealed class ProcessUsageSamplerTests
{
    private sealed class FakeProbe : IProcessProbe
    {
        public List<ProcessEntryModel> Processes { get; } = [new(1, 0, "Tily.exe"), new(10, 1, "powershell.exe")];

        public Dictionary<int, ProcessCountersModel> Counter { get; } = new()
        {
            [1] = new(TimeSpan.Zero, 100 * 1048576L),
            [10] = new(TimeSpan.Zero, 50 * 1048576L)
        };

        public IReadOnlyList<ProcessEntryModel> Snapshot() => Processes;

        public ProcessCountersModel? Counters(int processId) => Counter.GetValueOrDefault(processId);
    }

    private readonly FakeProbe _probe = new();
    private DateTime _now = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    private readonly Dictionary<string, IReadOnlyList<int>> _panes = new() { ["pane-a"] = [10] };

    private ProcessUsageSampler Create() => new(_probe, () => _now);

    [Fact]
    public void Sample_WhenFirstSample_ThenCpuIsZeroAndRamInMegabytes()
    {
        var activity = Create().Sample(_panes, 1);

        Assert.Equal(0, activity.Panes.Single().Processes.Single().Cpu);
        Assert.Equal(50, activity.Panes.Single().Processes.Single().Ram);
    }

    [Fact]
    public void Sample_WhenSecondSample_ThenCpuIsShareOfElapsedTimeAcrossProcessors()
    {
        var sampler = Create();
        sampler.Sample(_panes, 1);
        _now = _now.AddSeconds(2);
        _probe.Counter[10] = new(TimeSpan.FromMilliseconds(1000 * Environment.ProcessorCount), 50 * 1048576L);

        var activity = sampler.Sample(_panes, 1);

        Assert.Equal(50, activity.Panes.Single().Processes.Single().Cpu);
    }

    [Fact]
    public void Sample_WhenCountersUnavailable_ThenProcessSkipped()
    {
        _probe.Counter.Remove(10);

        var activity = Create().Sample(_panes, 1);

        Assert.Empty(activity.Panes);
    }

    [Fact]
    public void Sample_WhenHostRoot_ThenHostListsItself()
    {
        var activity = Create().Sample(_panes, 1);

        Assert.Equal([1], activity.Host.Select(process => process.Id));
    }
}

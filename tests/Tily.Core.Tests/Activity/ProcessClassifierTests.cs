using Tily.Core.Activity;
using Xunit;

namespace Tily.Core.Tests.Activity;

public sealed class ProcessClassifierTests
{
    private static readonly IReadOnlyList<ProcessEntryModel> Snapshot =
    [
        new(1, 0, "Tily.exe"),
        new(10, 1, "powershell.exe"),
        new(11, 10, "claude.exe"),
        new(12, 11, "conhost.exe"),
        new(13, 11, "bash.exe"),
        new(14, 13, "node.exe"),
        new(15, 11, "node.exe"),
        new(20, 1, "msedgewebview2.exe"),
        new(21, 20, "msedgewebview2.exe"),
        new(30, 1, "OpenConsole.exe")
    ];

    [Fact]
    public void ClassifyPane_WhenClaudeRunsShell_ThenCommandsAndTheirChildren()
    {
        var processes = ProcessClassifier.ClassifyPane(Snapshot, [10, 11, 12, 13, 14, 15]);

        Assert.Equal(ProcessCategory.Commands, processes.Single(entry => entry.Process.Id == 13).Category);
        Assert.Equal(ProcessCategory.Commands, processes.Single(entry => entry.Process.Id == 14).Category);
    }

    [Fact]
    public void ClassifyPane_WhenClaudeRunsOtherProcess_ThenMcp()
    {
        var processes = ProcessClassifier.ClassifyPane(Snapshot, [10, 11, 15]);

        Assert.Equal(ProcessCategory.Mcp, processes.Single(entry => entry.Process.Id == 15).Category);
    }

    [Fact]
    public void ClassifyPane_WhenProcessIsOutsideClaude_ThenTerminal()
    {
        var processes = ProcessClassifier.ClassifyPane(Snapshot, [10, 11]);

        Assert.Equal(ProcessCategory.Terminal, processes.Single(entry => entry.Process.Id == 10).Category);
        Assert.Equal(ProcessCategory.Claude, processes.Single(entry => entry.Process.Id == 11).Category);
    }

    [Fact]
    public void ClassifyPane_WhenConhostUnderClaude_ThenStaysClaude()
    {
        var processes = ProcessClassifier.ClassifyPane(Snapshot, [10, 11, 12]);

        Assert.Equal(ProcessCategory.Claude, processes.Single(entry => entry.Process.Id == 12).Category);
    }

    [Fact]
    public void ClassifyPane_WhenNested_ThenDepthCountsAncestorsInPane()
    {
        var processes = ProcessClassifier.ClassifyPane(Snapshot, [10, 11, 13, 14]);

        Assert.Equal([0, 1, 2, 3], processes.OrderBy(entry => entry.Process.Id).Select(entry => entry.Depth));
    }

    [Fact]
    public void ClassifyPane_WhenParentCycle_ThenTerminates()
    {
        ProcessEntryModel[] cycle = [new(1, 2, "a.exe"), new(2, 1, "b.exe")];

        var processes = ProcessClassifier.ClassifyPane(cycle, [1, 2]);

        Assert.Empty(processes);
    }

    [Fact]
    public void ClassifyHost_WhenWebViewsAndPaneJobs_ThenExcludesPanesAndLabelsWebViews()
    {
        var processes = ProcessClassifier.ClassifyHost(Snapshot, 1, new HashSet<int> { 10, 11, 12, 13, 14, 15 });

        Assert.Equal([1, 20, 21, 30], processes.Select(entry => entry.Process.Id).Order());
        Assert.Equal(ProcessCategory.App, processes.Single(entry => entry.Process.Id == 1).Category);
        Assert.Equal(ProcessCategory.WebView, processes.Single(entry => entry.Process.Id == 21).Category);
        Assert.Equal(ProcessCategory.Other, processes.Single(entry => entry.Process.Id == 30).Category);
    }

    [Fact]
    public void ClassifyHost_WhenWebViewRolesKnown_ThenSeparatesInterfaceFromEngine()
    {
        var roles = new Dictionary<int, string> { [21] = ProcessCategory.Interface };

        var processes = ProcessClassifier.ClassifyHost(Snapshot, 1, new HashSet<int>(), roles);

        Assert.Equal(ProcessCategory.Interface, processes.Single(entry => entry.Process.Id == 21).Category);
        Assert.Equal(ProcessCategory.WebView, processes.Single(entry => entry.Process.Id == 20).Category);
    }
}

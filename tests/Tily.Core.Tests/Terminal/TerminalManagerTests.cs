using System.ComponentModel;
using System.Diagnostics;
using System.Text;
using Tily.Core.Native;
using Tily.Core.Shell;
using Tily.Core.Terminal;
using Xunit;

namespace Tily.Core.Tests.Terminal;

public sealed class TerminalManagerTests
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan StopTimeout = TimeSpan.FromSeconds(10);
    private static readonly HashSet<string?> ConsoleHostNames = new(StringComparer.OrdinalIgnoreCase) { "conhost", "OpenConsole" };

    [Fact]
    public async Task Start_WhenPowerShell_ThenReportsCurrentDirectoryAndInjectsPaneVariable()
    {
        using var manager = new TerminalManager();
        var directory = new TaskCompletionSource<string>();
        var output = new StringBuilder();
        manager.CurrentDirectoryChanged += (_, path) => directory.TrySetResult(path);
        manager.OutputReceived += (_, data) => { lock (output) { output.Append(Encoding.UTF8.GetString(data.Span)); } };
        var home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);

        var session = manager.Start("pane-test", ShellCatalog.DefaultShellId, home, 100, 30);
        var reported = await directory.Task.WaitAsync(Timeout);
        session.Write(Encoding.UTF8.GetBytes("Write-Host ('TILYVAR|' + $env:TILY_PANE_ID + '|FIN')\r"));
        await WaitForAsync(() => { lock (output) { return output.ToString().Contains("TILYVAR|pane-test|FIN"); } });

        Assert.Equal(Path.TrimEndingDirectorySeparator(home), Path.TrimEndingDirectorySeparator(reported), StringComparer.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Stop_WhenChildProcessesRunning_ThenNoneSurvive()
    {
        using var manager = new TerminalManager();
        var directory = new TaskCompletionSource<string>();
        manager.CurrentDirectoryChanged += (_, path) => directory.TrySetResult(path);
        var session = manager.Start("pane-job", ShellCatalog.DefaultShellId, Path.GetTempPath(), 100, 30);
        await directory.Task.WaitAsync(Timeout);
        session.Write(Encoding.UTF8.GetBytes("Start-Process cmd -WindowStyle Hidden -ArgumentList '/c','ping -t 127.0.0.1 > nul'\r"));
        await WaitForAsync(() => session.JobProcessIds().Count >= 3);
        var processes = session.JobProcessIds().Select(OpenProcess).OfType<Process>().ToList();

        manager.Stop("pane-job");

        try
        {
            Assert.All(processes, process => Assert.True(process.WaitForExit(StopTimeout), $"Processus {process.Id} encore vivant après l’arrêt du pane."));
        }
        finally
        {
            processes.ForEach(process => process.Dispose());
        }
    }

    [Fact]
    public async Task Activity_WhenProgramRunning_ThenListsItWithoutTheShell()
    {
        using var manager = new TerminalManager();
        var directory = new TaskCompletionSource<string>();
        manager.CurrentDirectoryChanged += (_, path) => directory.TrySetResult(path);
        var session = manager.Start("pane-activity", ShellCatalog.DefaultShellId, Path.GetTempPath(), 100, 30);
        await directory.Task.WaitAsync(Timeout);

        session.Write(Encoding.UTF8.GetBytes("ping -t 127.0.0.1 > $null\r"));
        await WaitForAsync(() => manager.Activity(new[] { "pane-activity" }).Any(activity => activity.Processes.Contains("ping", StringComparer.OrdinalIgnoreCase)));
        var activity = manager.Activity(new[] { "pane-activity" }).Single();

        Assert.Equal("pane-activity", activity.PaneId);
        Assert.DoesNotContain("powershell", activity.Processes, StringComparer.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Write_WhenHostIgnoresCtrlC_ThenCtrlCStillInterruptsProgram()
    {
        using var manager = new TerminalManager();
        var directory = new TaskCompletionSource<string>();
        manager.CurrentDirectoryChanged += (_, path) => directory.TrySetResult(path);
        ProcessApi.SetConsoleCtrlHandler(IntPtr.Zero, true);
        try
        {
            var session = manager.Start("pane-ctrl-c", ShellCatalog.DefaultShellId, Path.GetTempPath(), 100, 30);
            await directory.Task.WaitAsync(Timeout);
            session.Write(Encoding.UTF8.GetBytes("ping -t 127.0.0.1 > $null\r"));
            await WaitForAsync(() => RunsPing(manager, "pane-ctrl-c"));

            session.Write(Encoding.UTF8.GetBytes("\u0003"));

            Assert.True(await EventuallyAsync(() => !RunsPing(manager, "pane-ctrl-c")), "Ctrl + C n’a pas interrompu le programme du pane.");
        }
        finally
        {
            ProcessApi.SetConsoleCtrlHandler(IntPtr.Zero, false);
        }
    }

    [Fact]
    public async Task ProcessIds_WhenShellRuns_ThenIncludesItsConsoleHost()
    {
        using var manager = new TerminalManager();
        var directory = new TaskCompletionSource<string>();
        manager.CurrentDirectoryChanged += (_, path) => directory.TrySetResult(path);
        manager.Start("pane-console", ShellCatalog.DefaultShellId, Path.GetTempPath(), 100, 30);
        await directory.Task.WaitAsync(Timeout);

        var processIds = manager.ProcessIds()["pane-console"];

        Assert.Contains(processIds, processId => ConsoleHostNames.Contains(ProcessNameOf(processId)));
    }

    [Fact]
    public void Activity_WhenPaneUnknown_ThenReportsNothing()
    {
        using var manager = new TerminalManager();

        var activity = manager.Activity(new[] { "pane-inconnu" });

        Assert.Empty(activity);
    }

    [Fact]
    public void Start_WhenShellUnknown_ThenThrowsFrenchMessage()
    {
        using var manager = new TerminalManager();

        var exception = Assert.Throws<InvalidOperationException>(() => manager.Start("pane", "inconnu", "C:\\", 80, 24));

        Assert.Equal("Shell inconnu : inconnu", exception.Message);
    }

    private static async Task WaitForAsync(Func<bool> condition)
    {
        var clock = Stopwatch.StartNew();
        while (!condition())
        {
            if (clock.Elapsed > Timeout)
            {
                throw new TimeoutException("Condition non remplie dans le délai imparti.");
            }

            await Task.Delay(100);
        }
    }

    private static async Task<bool> EventuallyAsync(Func<bool> condition)
    {
        try
        {
            await WaitForAsync(condition);
            return true;
        }
        catch (TimeoutException)
        {
            return false;
        }
    }

    private static bool RunsPing(TerminalManager manager, string paneId) =>
        manager.Activity(new[] { paneId }).Any(activity => activity.Processes.Contains("ping", StringComparer.OrdinalIgnoreCase));

    private static string? ProcessNameOf(int processId)
    {
        using var process = OpenProcess(processId);
        return process?.ProcessName;
    }

    private static Process? OpenProcess(int processId)
    {
        Process? process = null;
        try
        {
            process = Process.GetProcessById(processId);
            _ = process.SafeHandle;
            return process;
        }
        catch (Exception exception) when (exception is ArgumentException or InvalidOperationException or Win32Exception)
        {
            process?.Dispose();
            return null;
        }
    }
}

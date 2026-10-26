using System.Collections;
using System.Diagnostics;
using Tily.Core.Native;
using Tily.Core.Shell;

namespace Tily.Core.Terminal;

public sealed class TerminalSession : IDisposable
{
    private const int ReadBufferSize = 64 * 1024;

    private readonly PseudoConsole _console;
    private readonly PtyProcess _process;
    private readonly JobObject _job;
    private readonly OscCwdParser _cwdParser = new();
    private readonly Thread _readerThread;
    private readonly object _writeLock = new();
    private int _closed;

    public string PaneId { get; }
    public DateTime StartedAtUtc { get; } = DateTime.UtcNow;
    public int ProcessId => _process.ProcessId;
    public string? CurrentDirectory { get; private set; }
    public bool HasExited { get; private set; }
    public uint ExitCode { get; private set; }

    public event Action<ReadOnlyMemory<byte>>? OutputReceived;
    public event Action<string>? CurrentDirectoryChanged;
    public event Action<uint>? Exited;

    public TerminalSession(TerminalSessionOptions options)
    {
        PaneId = options.PaneId;
        _console = new PseudoConsole(options.Columns, options.Rows);
        _job = new JobObject();
        try
        {
            _process = PtyProcess.StartSuspended(options.CommandLine, options.WorkingDirectory, BuildEnvironment(options), _console.Handle);
            _job.Assign(_process.Handle);
            _process.Resume();
        }
        catch
        {
            _job.Dispose();
            _console.Dispose();
            throw;
        }

        _cwdParser.CurrentDirectoryChanged += HandleCurrentDirectoryChanged;
        _readerThread = new Thread(ReadLoop) { IsBackground = true, Name = $"pty-reader-{PaneId}" };
        _readerThread.Start();
        ThreadPool.QueueUserWorkItem(_ => WaitForExit());
    }

    public IReadOnlyList<int> JobProcessIds() => _job.ProcessIds();

    public IReadOnlyList<string> ActiveProcessNames() => NamesOf(ActiveProcesses());

    public static IReadOnlyList<string> NamesOf(IEnumerable<ActiveProcessModel> processes) =>
        new SortedSet<string>(processes.Select(process => process.Name), StringComparer.OrdinalIgnoreCase).ToList();

    public IReadOnlyList<ActiveProcessModel> ActiveProcesses()
    {
        if (HasExited || Volatile.Read(ref _closed) == 1)
        {
            return Array.Empty<ActiveProcessModel>();
        }

        var processes = new List<ActiveProcessModel>();
        foreach (var processId in _job.ProcessIds())
        {
            var name = processId == ProcessId ? null : ProcessNameOf(processId);
            if (name is not null)
            {
                processes.Add(new ActiveProcessModel(processId, name));
            }
        }

        return processes;
    }

    public void Write(ReadOnlySpan<byte> data)
    {
        if (Volatile.Read(ref _closed) == 1)
        {
            return;
        }

        lock (_writeLock)
        {
            _console.Input.Write(data);
            _console.Input.Flush();
        }
    }

    public void Resize(int columns, int rows)
    {
        if (Volatile.Read(ref _closed) == 0 && columns > 0 && rows > 0)
        {
            _console.Resize(columns, rows);
        }
    }

    public void Close()
    {
        if (Interlocked.Exchange(ref _closed, 1) == 1)
        {
            return;
        }

        _job.Terminate();
        _console.Close();
    }

    private void ReadLoop()
    {
        var buffer = new byte[ReadBufferSize];
        try
        {
            while (true)
            {
                var count = _console.Output.Read(buffer, 0, buffer.Length);
                if (count <= 0)
                {
                    break;
                }

                _cwdParser.Feed(buffer.AsSpan(0, count));
                OutputReceived?.Invoke(buffer.AsMemory(0, count).ToArray());
            }
        }
        catch (Exception exception) when (exception is IOException or ObjectDisposedException)
        {
        }
    }

    private void WaitForExit()
    {
        ExitCode = _process.WaitForExit();
        HasExited = true;
        Close();
        Exited?.Invoke(ExitCode);
    }

    private static string? ProcessNameOf(int processId)
    {
        try
        {
            using var process = Process.GetProcessById(processId);
            return process.ProcessName;
        }
        catch (Exception exception) when (exception is ArgumentException or InvalidOperationException)
        {
            return null;
        }
    }

    private void HandleCurrentDirectoryChanged(string directory)
    {
        CurrentDirectory = directory;
        CurrentDirectoryChanged?.Invoke(directory);
    }

    private static Dictionary<string, string> BuildEnvironment(TerminalSessionOptions options)
    {
        var environment = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (DictionaryEntry entry in Environment.GetEnvironmentVariables())
        {
            var key = (string)entry.Key;
            if (!key.StartsWith("WEZTERM_", StringComparison.OrdinalIgnoreCase))
            {
                environment[key] = (string?)entry.Value ?? string.Empty;
            }
        }

        environment["TILY_TERMINAL"] = "1";
        environment["TILY_PANE_ID"] = options.PaneId;
        environment["TERM_PROGRAM"] = "TilyTerminal";
        foreach (var pair in options.ExtraEnvironment)
        {
            environment[pair.Key] = pair.Value;
        }

        return environment;
    }

    public void Dispose()
    {
        Close();
        _readerThread.Join(TimeSpan.FromSeconds(5));
        _process.Dispose();
        _job.Dispose();
        _console.Dispose();
    }
}

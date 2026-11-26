using System.Collections;
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
    private int _consoleHostProcessId;

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

    public IReadOnlyList<int> LiveProcessIds()
    {
        if (HasExited || Volatile.Read(ref _closed) == 1)
        {
            return Array.Empty<int>();
        }

        var processIds = _job.ProcessIds();
        var consoleHostProcessId = ConsoleHostProcessId();
        return consoleHostProcessId == 0 || processIds.Contains(consoleHostProcessId) ? processIds : [.. processIds, consoleHostProcessId];
    }

    public IReadOnlyList<string> ActiveProcessNames(IReadOnlyDictionary<int, string> processNames) => NamesOf(ActiveProcesses(processNames));

    public static IReadOnlyList<string> NamesOf(IEnumerable<ActiveProcessModel> processes) =>
        new SortedSet<string>(processes.Select(process => process.Name), StringComparer.OrdinalIgnoreCase).ToList();

    public IReadOnlyList<ActiveProcessModel> ActiveProcesses(IReadOnlyDictionary<int, string> processNames)
    {
        if (HasExited || Volatile.Read(ref _closed) == 1)
        {
            return Array.Empty<ActiveProcessModel>();
        }

        var processes = new List<ActiveProcessModel>();
        foreach (var processId in _job.ProcessIds())
        {
            if (processId != ProcessId && processNames.TryGetValue(processId, out var name))
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

    private int ConsoleHostProcessId()
    {
        if (_consoleHostProcessId == 0 && ProcessUsageApi.NtQueryInformationProcess(_process.Handle, ProcessUsageApi.ProcessConsoleHostProcess, out var consoleHost, IntPtr.Size, out _) == 0)
        {
            _consoleHostProcessId = (int)(consoleHost.ToInt64() & ~ProcessUsageApi.ConsoleHostProcessIdFlags);
        }

        return _consoleHostProcessId;
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

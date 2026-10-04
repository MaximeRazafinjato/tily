using System.ComponentModel;
using System.Text.Json;
using Tily.Core.Agents;
using Tily.Core.Session;
using Tily.Core.Terminal;

namespace Tily.Host.Bridge;

public sealed class AgentStateFeed : IDisposable
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(2);
    private static readonly TimeSpan ChangeDelay = TimeSpan.FromMilliseconds(150);

    private readonly TerminalManager _terminals;
    private readonly Action<object> _post;
    private readonly AgentStateRepository _states;
    private readonly AgentMonitor _monitor;
    private readonly FileSystemWatcher _watcher;
    private readonly object _refreshLock = new();
    private Timer? _timer;
    private int _changePending;
    private bool _disposed;
    private string _lastPosted = string.Empty;

    public AgentStateFeed(string dataDirectory, TerminalManager terminals, Action<object> post)
    {
        _terminals = terminals;
        _post = post;
        _states = new AgentStateRepository(dataDirectory);
        Directory.CreateDirectory(_states.Directory);
        _monitor = new AgentMonitor(_states, new ClaudeSessionRegistry(ClaudeSessionRegistry.DefaultDirectory()));
        Hooks = new ClaudeHooksInstaller(ScriptPath);
        _watcher = new FileSystemWatcher(_states.Directory, "*.json") { NotifyFilter = NotifyFilters.LastWrite | NotifyFilters.FileName };
        _watcher.Changed += HandleFileChanged;
        _watcher.Created += HandleFileChanged;
        _watcher.Deleted += HandleFileChanged;
        _watcher.EnableRaisingEvents = true;
    }

    public string ScriptPath { get; } = Path.Combine(AppContext.BaseDirectory, "hooks", "tily-agent-state.ps1");

    public string StateDirectory => _states.Directory;

    public ClaudeHooksInstaller Hooks { get; }

    public object Describe()
    {
        var status = Hooks.Status();
        return new { script = ScriptPath, stateDirectory = StateDirectory, settingsFile = status.SettingsFile, hooksInstalled = status.Installed };
    }

    public void Start() => _timer = new Timer(_ => Refresh(), null, PollInterval, PollInterval);

    public void Forget(string paneId) => _states.Delete(paneId);

    private void HandleFileChanged(object sender, FileSystemEventArgs args) => ScheduleSoon();

    private void ScheduleSoon()
    {
        if (Interlocked.Exchange(ref _changePending, 1) == 0)
        {
            _timer?.Change(ChangeDelay, PollInterval);
        }
    }

    private void Refresh()
    {
        if (!Monitor.TryEnter(_refreshLock))
        {
            ScheduleSoon();
            return;
        }

        try
        {
            Interlocked.Exchange(ref _changePending, 0);
            if (_disposed)
            {
                return;
            }

            var agents = _monitor.Resolve(_terminals.Probes());
            var json = JsonSerializer.Serialize(agents, SessionRepository.JsonOptions);
            if (json == _lastPosted)
            {
                return;
            }

            _lastPosted = json;
            _post(new { type = "agent.states", panes = agents });
        }
        catch (Exception exception) when (exception is Win32Exception or IOException or UnauthorizedAccessException or InvalidOperationException)
        {
        }
        finally
        {
            Monitor.Exit(_refreshLock);
        }
    }

    public void Dispose()
    {
        _watcher.Dispose();
        _timer?.Dispose();
        lock (_refreshLock)
        {
            _disposed = true;
        }
    }
}

using Tily.Core.Session;
using Tily.Core.Updates;

namespace Tily.Host.Bridge;

public sealed class UpdateRestartFeed : IDisposable
{
    private const string Refused = "Mise à jour annulée : une autre fenêtre de Tily a refusé de s’arrêter.";
    private const string Silent = "Mise à jour annulée : une autre fenêtre de Tily n’a pas répondu.";
    private const string OtherCancelled = "Mise à jour annulée : une autre fenêtre de Tily a refusé de s’arrêter ou n’a pas répondu.";
    private static readonly TimeSpan ChangeDelay = TimeSpan.FromMilliseconds(100);
    private static readonly TimeSpan WaitTick = TimeSpan.FromSeconds(1);
    private static readonly TimeSpan AnswerTimeout = TimeSpan.FromMinutes(2) + TimeSpan.FromSeconds(10);

    private readonly RestartCoordination _coordination;
    private readonly SessionStore _store;
    private readonly string _session;
    private readonly Action<object> _post;
    private readonly FileSystemWatcher _watcher;
    private readonly Timer _timer;
    private readonly object _sync = new();
    private readonly HashSet<string> _shown = [];
    private readonly Dictionary<string, bool> _answered = [];
    private OwnRestart? _own;
    private bool _disposed;

    public UpdateRestartFeed(string dataDirectory, string session, Action<object> post)
    {
        _coordination = new RestartCoordination(dataDirectory);
        _store = new SessionStore(dataDirectory);
        _session = session;
        _post = post;
        Directory.CreateDirectory(_coordination.Directory);
        _timer = new Timer(_ => Scan());
        _watcher = new FileSystemWatcher(_coordination.Directory, "*.json") { NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite };
        _watcher.Created += HandleChanged;
        _watcher.Changed += HandleChanged;
        _watcher.Renamed += HandleChanged;
        _watcher.EnableRaisingEvents = true;
        ScanSoon();
    }

    public void Begin(string version, Action<IReadOnlyList<int>> go, Action<string> cancel)
    {
        List<string> others;
        using (_store.EnterGate())
        {
            others = _store.Ids().Where(id => id != _session && _store.IsOpen(id)).ToList();
        }

        if (others.Count == 0)
        {
            go([Environment.ProcessId]);
            return;
        }

        lock (_sync)
        {
            _own = new OwnRestart(_coordination.Request(_session, version).Id, others, DateTime.UtcNow + AnswerTimeout, go, cancel);
        }

        _post(new { type = "update.notice", message = $"Mise à jour : fermeture des autres fenêtres de Tily ({others.Count}) après leur accord…", warning = false });
        _timer.Change(ChangeDelay, WaitTick);
    }

    public void Answer(BridgeCommandModel command)
    {
        var id = command.Id ?? throw new InvalidOperationException("Demande de redémarrage manquante.");
        lock (_sync)
        {
            if (!_shown.Contains(id) || !_answered.TryAdd(id, command.Confirmed))
            {
                return;
            }
        }

        _coordination.Answer(id, _session, command.Confirmed, Environment.ProcessId);
        ScanSoon();
    }

    private void HandleChanged(object sender, FileSystemEventArgs args) => ScanSoon();

    private void ScanSoon() => _timer.Change(ChangeDelay, _own is null ? Timeout.InfiniteTimeSpan : WaitTick);

    private void Scan()
    {
        lock (_sync)
        {
            if (_disposed)
            {
                return;
            }

            try
            {
                ShowNewRequests();
                FollowAnsweredRequests();
                FollowOwnRequest();
            }
            catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
            {
            }
        }
    }

    private void ShowNewRequests()
    {
        foreach (var request in _coordination.OpenRequests().Where(request => request.Initiator != _session && _shown.Add(request.Id)))
        {
            _post(new { type = "update.confirmRestart", id = request.Id, version = request.Version });
        }
    }

    private void FollowAnsweredRequests()
    {
        foreach (var (id, accepted) in _answered.ToList())
        {
            if (_coordination.Decision(id) is not { } decision)
            {
                continue;
            }

            _answered.Remove(id);
            if (decision.Go)
            {
                _post(new { type = "update.restart" });
            }
            else if (accepted)
            {
                _post(new { type = "update.notice", message = OtherCancelled, warning = true });
            }
        }
    }

    private void FollowOwnRequest()
    {
        if (_own is not { } own)
        {
            return;
        }

        RestartOutcome outcome;
        using (_store.EnterGate())
        {
            outcome = _coordination.Outcome(own.Id, own.Others, _store.IsOpen, DateTime.UtcNow > own.Deadline);
        }

        switch (outcome)
        {
            case RestartOutcome.Accepted:
                Finish(own, true, null);
                break;
            case RestartOutcome.Refused:
                Finish(own, false, Refused);
                break;
            case RestartOutcome.Silent:
                Finish(own, false, Silent);
                break;
        }
    }

    private void Finish(OwnRestart own, bool go, string? reason)
    {
        _own = null;
        _timer.Change(Timeout.InfiniteTimeSpan, Timeout.InfiniteTimeSpan);
        _coordination.Decide(own.Id, go);
        if (go)
        {
            own.Go(_coordination.Answers(own.Id).Select(answer => answer.ProcessId).Append(Environment.ProcessId).ToList());
        }
        else
        {
            own.Cancel(reason ?? Refused);
        }
    }

    public void Dispose()
    {
        _watcher.Dispose();
        _timer.Dispose();
        lock (_sync)
        {
            _disposed = true;
        }
    }

    private sealed record OwnRestart(string Id, IReadOnlyList<string> Others, DateTime Deadline, Action<IReadOnlyList<int>> Go, Action<string> Cancel);
}

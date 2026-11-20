using Tily.Core.StatusLog;

namespace Tily.Host.Bridge;

public sealed class StatusLogFeed
{
    private readonly StatusLogRepository _repository;
    private readonly BackgroundQueue _writes;
    private readonly Action<object> _post;
    private readonly bool _persisted;
    private bool _saveFailing;

    public StatusLogFeed(string dataDirectory, BackgroundQueue writes, Action<object> post, bool persisted)
    {
        _repository = new StatusLogRepository(dataDirectory);
        _writes = writes;
        _post = post;
        _persisted = persisted;
        LoadError = persisted ? _repository.Load() : null;
    }

    public string? LoadError { get; }

    public IReadOnlyList<StatusLogEntryModel> Entries() => _repository.Entries();

    public void Handle(BridgeCommandModel command)
    {
        switch (command.Type)
        {
            case "statusLog.append":
                Append(command);
                break;
            case "statusLog.clear":
                _repository.Clear();
                _post(new { type = "statusLog.cleared" });
                SaveSoon();
                break;
            default:
                throw new InvalidOperationException($"Commande inconnue : {command.Type}");
        }
    }

    private void Append(BridgeCommandModel command)
    {
        var entry = _repository.Append(StatusLogRepository.ParseLevel(command.Level), command.Message, DateTimeOffset.Now);
        if (entry is null)
        {
            return;
        }

        _post(new { type = "statusLog.added", entry });
        SaveSoon();
    }

    private void SaveSoon()
    {
        if (_persisted)
        {
            _writes.Enqueue(Save);
        }
    }

    private void Save()
    {
        try
        {
            _repository.Save();
            _saveFailing = false;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            if (_saveFailing)
            {
                return;
            }

            _saveFailing = true;
            _post(new { type = "error", message = $"Journal de la barre de statut non enregistré dans {_repository.FilePath} : {exception.Message}" });
        }
    }
}

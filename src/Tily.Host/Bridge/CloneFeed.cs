using Tily.Core.Clone;
using Tily.Core.Git;
using Tily.Core.Settings;
using Tily.Core.StatusLog;
using Tily.Core.Worktrees;

namespace Tily.Host.Bridge;

public sealed class CloneFeed
{
    private readonly Action<object> _post;
    private readonly Func<SettingsModel> _settings;
    private readonly GitRunner _runner = new();
    private readonly BackgroundQueue _plans;
    private readonly BackgroundQueue _operations;

    public CloneFeed(Action<object> post, Func<SettingsModel> settings, Action<Exception> onError)
    {
        _post = post;
        _settings = settings;
        _plans = new BackgroundQueue(onError);
        _operations = new BackgroundQueue(onError);
    }

    public void Handle(BridgeCommandModel command)
    {
        switch (command.Type)
        {
            case "clone.suggest":
                _plans.Enqueue(() => _post(new { type = "clone.suggested", request = command.Request, address = CloneAddress.Suggestion(command.Url) }));
                break;
            case "clone.plan":
                _plans.Enqueue(() => Plan(command));
                break;
            case "clone.start":
                _operations.Enqueue(() => Start(command));
                break;
            default:
                throw new InvalidOperationException($"Commande inconnue : {command.Type}");
        }
    }

    private void Plan(BridgeCommandModel command)
    {
        var roots = Roots();
        _post(new { type = "clone.planned", request = command.Request, plan = ClonePlanner.Plan(RequestOf(command), roots[0]), roots });
    }

    private void Start(BridgeCommandModel command)
    {
        var request = command.Request;
        try
        {
            var result = RepositoryCloner.Clone(_runner, RequestOf(command), Roots()[0], message => _post(new { type = "clone.progress", request, message }));
            var install = WorktreeCreator.InstallCommandFor(result.Path, command.Install);
            var claude = ClaudeLaunchCommand.For(command.Claude, null);
            _post(new { type = "clone.done", request, path = result.Path, name = result.Name, install, claude, message = $"Dépôt « {result.Name} » cloné dans {result.Path}." });
        }
        catch (CloneException failure)
        {
            _post(new { type = "clone.failed", request, message = failure.Message, output = failure.Output.Length > 0 ? failure.Output : null });
        }
        catch (Exception exception)
        {
            _post(new { type = "clone.failed", request, message = UserErrorMessage.Of(exception), output = (exception as GitCommandException)?.Output is { Length: > 0 } output ? output : null });
        }
    }

    private IReadOnlyList<string> Roots() => [_settings().ProjectsRoot];

    private static CloneRequestModel RequestOf(BridgeCommandModel command) => new(command.Url, command.Folder, command.Name);
}

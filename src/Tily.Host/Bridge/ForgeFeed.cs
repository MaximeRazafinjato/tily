using Tily.Core.Forge;
using Tily.Core.StatusLog;

namespace Tily.Host.Bridge;

public sealed class ForgeFeed
{
    private readonly Action<object> _post;
    private readonly ForgeService _service = new();
    private readonly BackgroundQueue _lists;
    private readonly BackgroundQueue _branches;

    public ForgeFeed(Action<object> post, Action<Exception> onError)
    {
        _post = post;
        _lists = new BackgroundQueue(onError);
        _branches = new BackgroundQueue(onError);
    }

    public void Handle(BridgeCommandModel command)
    {
        switch (command.Type)
        {
            case "forge.list":
                List(command);
                break;
            case "forge.branch":
                Branch(command);
                break;
            default:
                throw new InvalidOperationException($"Commande inconnue : {command.Type}");
        }
    }

    private void List(BridgeCommandModel command)
    {
        var path = command.Path ?? throw new InvalidOperationException("Chemin manquant.");
        var request = command.Request;
        var state = MergeRequestStateFilters.Parse(command.State);
        _lists.Enqueue(() =>
        {
            try
            {
                _post(new { type = "forge.listed", request, path, list = _service.List(path, state) });
            }
            catch (Exception exception)
            {
                _post(new { type = "forge.listed", request, path, error = UserErrorMessage.Of(exception) });
            }
        });
    }

    private void Branch(BridgeCommandModel command)
    {
        var path = command.Path ?? throw new InvalidOperationException("Chemin manquant.");
        var branch = command.Branch ?? throw new InvalidOperationException("Branche manquante.");
        var force = command.Force;
        _branches.Enqueue(() =>
        {
            BranchMergeRequestsModel result;
            try
            {
                result = _service.ForBranch(path, branch, force);
            }
            catch (Exception exception)
            {
                result = new BranchMergeRequestsModel(null, [], UserErrorMessage.Of(exception));
            }

            _post(new { type = "forge.branchListed", path, branch, result });
        });
    }
}

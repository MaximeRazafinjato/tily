using Tily.Core.Forge;
using Tily.Core.StatusLog;

namespace Tily.Host.Bridge;

public sealed class ForgeFeed
{
    private readonly Action<object> _post;
    private readonly ForgeService _service;
    private readonly Action _gitChanged;
    private readonly BackgroundQueue _lists;
    private readonly BackgroundQueue _branches;
    private readonly BackgroundQueue _forms;

    public ForgeFeed(Action<object> post, Func<string> baseBranch, Action gitChanged, Action<Exception> onError)
    {
        _post = post;
        _service = new ForgeService(baseBranch: baseBranch);
        _gitChanged = gitChanged;
        _lists = new BackgroundQueue(onError);
        _branches = new BackgroundQueue(onError);
        _forms = new BackgroundQueue(onError);
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
            case "forge.form":
                Form(command);
                break;
            case "forge.compare":
                Compare(command);
                break;
            case "forge.create":
                Create(command);
                break;
            case "forge.update":
                Update(command);
                break;
            default:
                throw new InvalidOperationException($"Commande inconnue : {command.Type}");
        }
    }

    private void List(BridgeCommandModel command)
    {
        var path = command.Path ?? throw new InvalidOperationException("Chemin manquant.");
        var request = command.Request;
        _lists.Enqueue(() =>
        {
            try
            {
                _post(new { type = "forge.listed", request, path, list = _service.List(path) });
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

    private void Form(BridgeCommandModel command)
    {
        var path = command.Path ?? throw new InvalidOperationException("Chemin manquant.");
        var request = command.Request;
        var source = command.Branch;
        var number = NumberOf(command);
        _forms.Enqueue(() =>
        {
            try
            {
                _post(new { type = "forge.formLoaded", request, path, form = _service.FormData(path, source, number) });
            }
            catch (Exception exception)
            {
                _post(new { type = "forge.formLoaded", request, path, error = UserErrorMessage.Of(exception) });
            }
        });
    }

    private void Compare(BridgeCommandModel command)
    {
        var path = command.Path ?? throw new InvalidOperationException("Chemin manquant.");
        var source = command.Branch ?? throw new InvalidOperationException("Branche manquante.");
        var target = command.Target ?? string.Empty;
        var request = command.Request;
        var number = NumberOf(command);
        _forms.Enqueue(() =>
        {
            try
            {
                _post(new { type = "forge.compared", request, path, branch = _service.BranchInfo(path, source, target, number) });
            }
            catch (Exception exception)
            {
                _post(new { type = "forge.compared", request, path, error = UserErrorMessage.Of(exception) });
            }
        });
    }

    private void Create(BridgeCommandModel command)
    {
        var path = command.Path ?? throw new InvalidOperationException("Chemin manquant.");
        var request = command.Request;
        var input = command.MergeRequest;
        var push = command.Push;
        _forms.Enqueue(() =>
        {
            try
            {
                var created = _service.Create(path, input, push);
                _post(new { type = "forge.created", request, path, source = input?.SourceBranch, created });
            }
            catch (Exception exception)
            {
                _post(new { type = "forge.created", request, path, source = input?.SourceBranch, error = UserErrorMessage.Of(exception) });
            }
            finally
            {
                if (push)
                {
                    _gitChanged();
                }
            }
        });
    }

    private void Update(BridgeCommandModel command)
    {
        var path = command.Path ?? throw new InvalidOperationException("Chemin manquant.");
        var request = command.Request;
        var number = command.Number;
        var original = command.Original;
        var input = command.MergeRequest;
        var push = command.Push;
        var close = command.Close;
        _forms.Enqueue(() =>
        {
            try
            {
                var updated = _service.Update(path, number, original, input, push, close);
                _post(new { type = "forge.updated", request, path, source = input?.SourceBranch, updated });
            }
            catch (Exception exception)
            {
                _post(new { type = "forge.updated", request, path, source = input?.SourceBranch, error = UserErrorMessage.Of(exception) });
            }
            finally
            {
                if (push)
                {
                    _gitChanged();
                }
            }
        });
    }

    private static int? NumberOf(BridgeCommandModel command) => command.Number > 0 ? command.Number : null;
}

using Tily.Core.Context;
using Tily.Core.Git;

namespace Tily.Core.Clone;

public static class RepositoryCloner
{
    private static readonly TimeSpan Timeout = TimeSpan.FromHours(2);

    public static CloneResultModel Clone(GitRunner runner, CloneRequestModel request, string defaultFolder, Action<string> progress)
    {
        var address = CloneAddress.Require(request.Address);
        var plan = ClonePlanner.Plan(request with { Address = address }, defaultFolder);
        var path = plan.Path ?? throw new CloneException(plan.Error ?? "Clonage impossible.");
        progress($"Clonage de « {plan.Name} »…");
        var reporter = new CloneProgress(plan.Name, progress);
        var options = new GitRunOptionsModel(NeutralLocale: true, Timeout: Timeout, Progress: reporter.Report);
        var output = runner.Run(PathFallback.NearestExisting(plan.Folder), ["clone", "--progress", "--", address, path], options);
        return output.Succeeded ? new CloneResultModel(path, plan.Name) : throw new CloneException($"Le clonage de « {plan.Name} » a échoué.", output.Details);
    }
}

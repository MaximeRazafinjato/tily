using Tily.Core.Git;

namespace Tily.Core.Worktrees;

public static class WorktreeCreator
{
    public const string InstallCommand = "pnpm install";

    private const string HeadsPrefix = "refs/heads/";
    private const string RemotesPrefix = "refs/remotes/";
    private const string RemoteHeadSuffix = "/HEAD";
    private const string PreferredRemote = "origin";
    private static readonly string[] FallbackBases = ["main", "master"];
    private const string PackageFile = "package.json";

    private sealed record ContextModel(GitRepository Main, WorktreeRepositoryModel Info, IReadOnlyList<WorktreeModel> Worktrees);

    private sealed record TargetModel(string Path, string LocalBranch);

    public static WorktreePlanModel Plan(GitRunner runner, WorktreeRequestModel request, WorktreeSettingsModel settings, string projectsRoot)
    {
        ContextModel context;
        try
        {
            context = Inspect(runner, request.Repository);
        }
        catch (Exception exception) when (exception is WorktreeException or GitCommandException)
        {
            return new WorktreePlanModel(request.Repository, WorktreeTarget.Project(request.Repository), null, null, null, [], [], exception.Message);
        }

        var defaultBase = DefaultBaseOf(settings.DefaultBase, context);
        var folder = string.IsNullOrWhiteSpace(request.Folder) ? settings.FolderFor(projectsRoot) : request.Folder.Trim();
        try
        {
            var target = Target(context, request, settings, projectsRoot);
            if (target is not null && request.Mode == WorktreeBranchMode.New)
            {
                RequireBase(context, BaseOf(request, settings, context));
            }

            return Planned(context, defaultBase, target, null, settings, folder);
        }
        catch (Exception exception) when (exception is WorktreeException or GitCommandException)
        {
            return Planned(context, defaultBase, null, exception.Message, settings, folder);
        }
    }

    public static WorktreeCreationModel Create(GitRunner runner, WorktreeRequestModel request, WorktreeSettingsModel settings, string projectsRoot, Action<string> progress)
    {
        var context = Inspect(runner, request.Repository);
        var target = Target(context, request, settings, projectsRoot) ?? throw new WorktreeException("Indiquez le nom de la branche.", WorktreeSteps.Verification);
        var steps = new List<WorktreeStepModel>();
        string[] arguments;
        switch (request.Mode)
        {
            case WorktreeBranchMode.New:
                var start = RequireBase(context, BaseOf(request, settings, context));
                if (RemoteOf(start, context.Info) is { } remote)
                {
                    progress($"Fetch de {start}…");
                    var fetched = context.Main.Run("fetch", remote, start[(remote.Length + 1)..]);
                    if (!fetched.Succeeded)
                    {
                        throw new WorktreeException($"Échec du fetch de {start}.", WorktreeSteps.Fetch, fetched.Details);
                    }

                    steps.Add(WorktreeSteps.Ok(WorktreeSteps.Fetch, $"Fetch de {start} terminé."));
                }

                arguments = ["worktree", "add", "--no-track", "-b", target.LocalBranch, target.Path, start];
                break;
            case WorktreeBranchMode.Remote:
                arguments = ["worktree", "add", "--track", "-b", target.LocalBranch, target.Path, request.Branch.Trim()];
                break;
            default:
                arguments = ["worktree", "add", target.Path, target.LocalBranch];
                break;
        }

        progress("Création du worktree…");
        var added = context.Main.Run(arguments);
        if (!added.Succeeded)
        {
            throw new WorktreeException("Échec de la création du worktree.", WorktreeSteps.Creation, added.Details);
        }

        steps.Add(WorktreeSteps.Ok(WorktreeSteps.Creation, $"Worktree créé dans {target.Path} (branche {target.LocalBranch})."));
        return new WorktreeCreationModel(target.Path, Path.GetFileName(target.Path), target.LocalBranch, context.Info.Project, context.Info.MainRoot, steps);
    }

    public static string? InstallCommandFor(string path, bool requested) =>
        requested && File.Exists(Path.Combine(path, PackageFile)) ? InstallCommand : null;

    private static ContextModel Inspect(GitRunner runner, string folder)
    {
        var location = GitRepository.Locate(runner, folder) ?? throw new WorktreeException($"Aucun dépôt Git dans {folder}.", WorktreeSteps.Verification);
        var repository = new GitRepository(runner, location);
        var worktrees = WorktreeLister.List(repository);
        var mainRoot = WorktreeTarget.MainRoot(repository, worktrees);
        var main = GitRepository.Locate(runner, mainRoot) is { } mainLocation ? new GitRepository(runner, mainLocation) : repository;
        var references = main.Read("for-each-ref", "--format=%(refname)", HeadsPrefix, RemotesPrefix)
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var local = NamesUnder(references, HeadsPrefix).ToList();
        var remote = NamesUnder(references, RemotesPrefix).Where(name => !name.EndsWith(RemoteHeadSuffix, StringComparison.Ordinal)).ToList();
        var info = new WorktreeRepositoryModel(mainRoot, WorktreeTarget.Project(mainRoot), local, remote, main.Remotes());
        return new ContextModel(main, info, worktrees);
    }

    private static IEnumerable<string> NamesUnder(IEnumerable<string> references, string prefix) =>
        references
            .Where(reference => reference.StartsWith(prefix, StringComparison.Ordinal))
            .Select(reference => reference[prefix.Length..])
            .Order(StringComparer.OrdinalIgnoreCase);

    private static TargetModel? Target(ContextModel context, WorktreeRequestModel request, WorktreeSettingsModel settings, string projectsRoot)
    {
        var branch = request.Branch?.Trim() ?? string.Empty;
        if (branch.Length == 0)
        {
            return null;
        }

        var local = request.Mode switch
        {
            WorktreeBranchMode.New => NewBranch(context, branch),
            WorktreeBranchMode.Remote => TrackingBranch(context, branch),
            _ => ExistingBranch(context, branch)
        };
        var path = WorktreeTarget.PathFor(FolderOf(request, settings, projectsRoot), context.Info.Project, local);
        if (Directory.Exists(path) || File.Exists(path))
        {
            throw new WorktreeException($"Le dossier existe déjà : {path}", WorktreeSteps.Verification);
        }

        return new TargetModel(path, local);
    }

    private static string FolderOf(WorktreeRequestModel request, WorktreeSettingsModel settings, string projectsRoot)
    {
        if (string.IsNullOrWhiteSpace(request.Folder))
        {
            return settings.FolderFor(projectsRoot);
        }

        var folder = request.Folder.Trim();
        return Path.IsPathRooted(folder)
            ? folder
            : throw new WorktreeException($"Le dossier des worktrees doit être un chemin absolu : {folder}", WorktreeSteps.Verification);
    }

    private static string NewBranch(ContextModel context, string branch)
    {
        var name = GitNames.RequireBranchName(context.Main, branch);
        return context.Info.LocalBranches.Contains(name, StringComparer.Ordinal)
            ? throw new WorktreeException($"La branche « {name} » existe déjà : choisissez « Branche existante ».", WorktreeSteps.Verification)
            : name;
    }

    private static string ExistingBranch(ContextModel context, string branch)
    {
        if (!context.Info.LocalBranches.Contains(branch, StringComparer.Ordinal))
        {
            throw new WorktreeException($"Branche locale introuvable : « {branch} ».", WorktreeSteps.Verification);
        }

        var user = context.Worktrees.FirstOrDefault(worktree => worktree.Branch == branch);
        return user is null ? branch : throw new WorktreeException($"La branche « {branch} » est déjà utilisée par le worktree {user.Path}.", WorktreeSteps.Verification);
    }

    private static string TrackingBranch(ContextModel context, string branch)
    {
        var remote = context.Info.RemoteBranches.Contains(branch, StringComparer.Ordinal) ? RemoteOf(branch, context.Info) : null;
        if (remote is null)
        {
            throw new WorktreeException($"Branche distante introuvable : « {branch} ». Faites un fetch.", WorktreeSteps.Verification);
        }

        var local = branch[(remote.Length + 1)..];
        return context.Info.LocalBranches.Contains(local, StringComparer.Ordinal)
            ? throw new WorktreeException($"Une branche locale « {local} » existe déjà : choisissez-la dans « Branche existante ».", WorktreeSteps.Verification)
            : local;
    }

    private static string? RemoteOf(string reference, WorktreeRepositoryModel info) =>
        info.Remotes
            .Where(remote => reference.StartsWith(remote + "/", StringComparison.Ordinal) && reference.Length > remote.Length + 1)
            .OrderByDescending(remote => remote.Length)
            .FirstOrDefault();

    private static string ResolveBase(string requested, WorktreeRepositoryModel info)
    {
        var name = requested.Trim();
        if (RemoteOf(name, info) is not null)
        {
            return name;
        }

        var remote = info.Remotes.Contains(PreferredRemote) ? PreferredRemote : info.Remotes.FirstOrDefault();
        var remoteBranch = $"{remote}/{name}";
        var local = info.LocalBranches.Contains(name, StringComparer.Ordinal);
        return remote is null || (local && !info.RemoteBranches.Contains(remoteBranch, StringComparer.Ordinal)) ? name : remoteBranch;
    }

    private static string RequireBase(ContextModel context, string requested)
    {
        var start = ResolveBase(GitNames.RequireRevision(requested.Trim()), context.Info);
        return RemoteOf(start, context.Info) is not null || context.Main.Resolve(start) is not null
            ? start
            : throw new WorktreeException($"Base introuvable : « {start} ».", WorktreeSteps.Verification);
    }

    private static string BaseOf(WorktreeRequestModel request, WorktreeSettingsModel settings, ContextModel context) =>
        string.IsNullOrWhiteSpace(request.Base) ? DefaultBaseOf(settings.DefaultBase, context) : request.Base;

    private static string DefaultBaseOf(string configured, ContextModel context)
    {
        var resolved = ResolveBase(configured, context.Info);
        return HasBranch(resolved, context.Info) || IsRevision(context.Main, resolved)
            ? resolved
            : FallbackBases.Select(branch => ResolveBase(branch, context.Info)).FirstOrDefault(candidate => HasBranch(candidate, context.Info)) ?? resolved;
    }

    private static bool IsRevision(GitRepository repository, string revision)
    {
        try
        {
            return repository.Resolve(revision) is not null;
        }
        catch (GitCommandException)
        {
            return false;
        }
    }

    private static bool HasBranch(string branch, WorktreeRepositoryModel info) =>
        info.RemoteBranches.Contains(branch, StringComparer.Ordinal) || info.LocalBranches.Contains(branch, StringComparer.Ordinal);

    private static WorktreePlanModel Planned(ContextModel context, string defaultBase, TargetModel? target, string? error, WorktreeSettingsModel settings, string folder) =>
        new(context.Info.MainRoot, context.Info.Project, target?.Path, target?.LocalBranch, defaultBase, context.Info.LocalBranches, context.Info.RemoteBranches, error, ResolveBase(settings.DefaultBase, context.Info), folder, PathPreview: target?.Path ?? Path.Combine(folder, $"{context.Info.Project}-<branche>"));
}

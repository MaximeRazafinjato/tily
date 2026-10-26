namespace Tily.Core.Git;

public static class GitSyncCommands
{
    private const string HeadsPrefix = "refs/heads/";
    private const string Origin = "origin";
    private static readonly PushAdviceModel ForceAdvice = new("votre branche", "un pull", true);

    public static GitOutcomeModel Push(GitRepository repository, bool force, bool confirmed, bool forceAllowed)
    {
        var branch = repository.CurrentBranch() ?? throw new GitCommandException("HEAD détachée : faites le checkout d’une branche avant le push.", string.Empty);
        if (force)
        {
            GitPaths.RequireConfirmation(confirmed);
            if (!forceAllowed)
            {
                throw new GitCommandException("Le push forcé n’est proposé qu’après un push refusé.", string.Empty);
            }
        }

        return PushRef(repository, branch, "HEAD", force);
    }

    public static GitOutcomeModel PushBranch(GitRepository repository, string branch) =>
        PushRef(repository, branch, $"{HeadsPrefix}{branch}", false);

    public static GitOutcomeModel PushUpTo(GitRepository repository, string? name, string? commit)
    {
        var branch = GitNames.RequireBranchName(repository, name);
        var tip = repository.Resolve($"{HeadsPrefix}{branch}") ?? throw new GitCommandException($"La branche « {branch} » n’existe plus.", string.Empty);
        var sha = commit is null ? tip : repository.RequireCommit(commit);
        if (sha != tip && !repository.IsAncestor(sha, tip))
        {
            throw new GitCommandException($"Le commit {GitRepository.Short(sha)} n’est pas sur la branche « {branch} ».", string.Empty);
        }

        var advice = branch == repository.CurrentBranch()
            ? ForceAdvice with { ForceOffered = false }
            : new PushAdviceModel($"« {branch} »", $"un checkout de « {branch} » puis un pull", false);
        return sha == tip ? PushRef(repository, branch, $"{HeadsPrefix}{branch}", false, advice) : PushRef(repository, branch, sha, false, advice, sha);
    }

    private static GitOutcomeModel PushRef(GitRepository repository, string branch, string source, bool force, PushAdviceModel? advice = null, string? upTo = null)
    {
        var target = Target(repository, branch);
        var arguments = new List<string> { "push", "--porcelain" };
        if (force)
        {
            arguments.Add($"--force-with-lease={target.Destination}");
        }

        if (target.Publish)
        {
            arguments.Add("--set-upstream");
        }

        arguments.AddRange([target.Remote, $"{source}:{target.Destination}"]);
        var output = repository.Run([.. arguments]);
        var rejected = output.Output.Split('\n').FirstOrDefault(line => line.StartsWith('!'));
        if (rejected is not null)
        {
            throw force
                ? new GitCommandException("Push forcé refusé : la branche distante a changé depuis le dernier fetch. Faites un fetch, vérifiez le graphe puis réessayez.", output.Details)
                : advice is null
                    ? new GitPushRejectedException(branch, Rejection(rejected, ForceAdvice), output.Details)
                    : new GitCommandException(Rejection(rejected, advice), output.Details);
        }

        GitRepository.Require(output, "Le push a échoué.");
        var destination = $"{target.Remote}/{target.Destination[HeadsPrefix.Length..]}";
        if (upTo is not null)
        {
            return PartialOutcome(repository, branch, target, destination, GitRepository.Short(upTo));
        }

        var message = force ? $"Push forcé vers {destination} (--force-with-lease)." : target.Publish ? $"Branche « {branch} » publiée sur {target.Remote}." : $"Push vers {destination} terminé.";
        return new GitOutcomeModel(message);
    }

    private static GitOutcomeModel PartialOutcome(GitRepository repository, string branch, PushTargetModel target, string destination, string upTo)
    {
        if (!target.Publish)
        {
            return new GitOutcomeModel($"Push vers {destination} jusqu’à {upTo} terminé.");
        }

        return repository.Run("branch", $"--set-upstream-to={destination}", branch).Succeeded
            ? new GitOutcomeModel($"Branche « {branch} » publiée sur {target.Remote} jusqu’à {upTo}.")
            : new GitOutcomeModel($"Branche « {branch} » publiée sur {target.Remote} jusqu’à {upTo}, mais elle ne suit pas encore {destination} : un push de toute la branche le configurera.", true);
    }

    public static GitOutcomeModel Pull(GitRepository repository)
    {
        var configRead = Task.Run(repository.ConfigSnapshot);
        var (before, current) = repository.HeadAndBranch();
        var branch = current ?? throw new GitCommandException("HEAD détachée : faites le checkout d’une branche avant le pull.", string.Empty);
        var config = configRead.GetAwaiter().GetResult();
        if (config.Get($"branch.{branch}.merge") is null)
        {
            throw new GitCommandException($"La branche « {branch} » ne suit aucune branche distante : faites d’abord un push pour la publier.", string.Empty);
        }

        repository.RequireNoOperation();
        var arguments = new List<string> { "pull" };
        if (config.Get($"branch.{branch}.rebase") is null && config.Get("pull.rebase") is null)
        {
            arguments.Add("--no-rebase");
        }

        var output = repository.Run([.. arguments]);
        if (!output.Succeeded)
        {
            if (repository.Operation() is not null)
            {
                var pending = before is null ? null : new GitUndoRecordModel { Kind = GitUndoKind.Pull, Label = "Pull", HeadBefore = before, BranchBefore = branch, Pending = true };
                return new GitOutcomeModel($"Pull interrompu : {GitText.Count(repository.Status().Conflicts.Count, "fichier en conflit", "fichiers en conflit")}.", true, pending, pending is null);
            }

            throw new GitCommandException("Le pull a échoué.", output.Details);
        }

        var after = repository.HeadSha();
        if (after == before)
        {
            return new GitOutcomeModel("Déjà à jour.");
        }

        var count = before is null ? null : repository.Read("rev-list", "--count", $"{before}..{after}").Trim();
        var record = before is null ? null : new GitUndoRecordModel { Kind = GitUndoKind.Pull, Label = "Pull", HeadBefore = before, HeadAfter = after, BranchBefore = branch, BranchAfter = branch, Published = true };
        return new GitOutcomeModel(count is null ? "Pull terminé." : $"Pull terminé : {GitText.Count(int.Parse(count), "nouveau commit", "nouveaux commits")}.", Undo: record, ClearUndo: record is null);
    }

    public static GitOutcomeModel Fetch(GitRepository repository)
    {
        if (repository.Remotes().Count == 0)
        {
            throw new GitCommandException("Aucun dépôt distant configuré : ajoutez-en un avec « git remote add ».", string.Empty);
        }

        GitRepository.Require(repository.Run("fetch", "--all"), "Le fetch a échoué.");
        return new GitOutcomeModel("Fetch terminé.");
    }

    public static GitOutcomeModel PushTag(GitRepository repository, string? name)
    {
        var tag = GitNames.RequireTagName(repository, name);
        var remote = DefaultRemote(repository, null);
        var output = repository.Run("push", "--porcelain", remote, $"refs/tags/{tag}:refs/tags/{tag}");
        if (output.Output.Split('\n').Any(line => line.StartsWith('!')))
        {
            throw new GitCommandException($"Push du tag refusé : « {tag} » existe déjà sur {remote} avec une autre cible.", output.Details);
        }

        GitRepository.Require(output, $"Le push du tag « {tag} » a échoué.");
        return new GitOutcomeModel($"Push du tag « {tag} » vers {remote} terminé.");
    }

    public static GitOutcomeModel DeleteRemoteBranch(GitRepository repository, string? reference, bool confirmed)
    {
        GitPaths.RequireConfirmation(confirmed);
        var name = GitNames.RequireRevision(reference);
        var remote = GitRefsReader.RemoteOf(repository.Remotes(), name) ?? throw new GitCommandException($"Branche distante inconnue : « {name} ».", string.Empty);
        GitRepository.Require(repository.Run("push", "--porcelain", remote, "--delete", $"{HeadsPrefix}{name[(remote.Length + 1)..]}"), $"La suppression de « {name} » a échoué.");
        return new GitOutcomeModel($"Branche distante « {name} » supprimée.", ClearUndo: true);
    }

    private static PushTargetModel Target(GitRepository repository, string branch)
    {
        var config = repository.ConfigSnapshot();
        var upstreamRemote = config.Get($"branch.{branch}.remote");
        var merge = config.Get($"branch.{branch}.merge");
        var pushRemote = config.Get($"branch.{branch}.pushRemote") ?? config.Get("remote.pushDefault");
        if (upstreamRemote is not null && upstreamRemote != "." && merge is not null && merge.StartsWith(HeadsPrefix, StringComparison.Ordinal))
        {
            var remote = pushRemote ?? upstreamRemote;
            return new PushTargetModel(remote, remote == upstreamRemote ? merge : $"{HeadsPrefix}{branch}", false);
        }

        return new PushTargetModel(DefaultRemote(repository, pushRemote), $"{HeadsPrefix}{branch}", true);
    }

    private static string DefaultRemote(GitRepository repository, string? preferred)
    {
        var remotes = repository.Remotes();
        var remote = preferred ?? repository.Config("remote.pushDefault") ?? (remotes.Contains(Origin) ? Origin : remotes.Count == 1 ? remotes[0] : null);
        return remote ?? throw new GitCommandException(
            remotes.Count == 0 ? "Aucun dépôt distant configuré : ajoutez-en un avec « git remote add »." : "Plusieurs dépôts distants et aucun « origin » : faites un premier push au terminal.",
            string.Empty);
    }

    private static string Rejection(string line, PushAdviceModel advice)
    {
        var start = line.LastIndexOf('(');
        var reason = start >= 0 ? line[(start + 1)..].TrimEnd(')', ' ', '\r') : string.Empty;
        var force = advice.ForceOffered ? ", ou forcez le push" : string.Empty;
        return reason switch
        {
            "fetch first" => $"Push refusé : la branche distante contient des commits absents de {advice.Branch}. Faites {advice.Pull} pour les intégrer{force}.",
            "non-fast-forward" => $"Push refusé : {advice.Branch} et la branche distante ont divergé (historique réécrit ?). Faites {advice.Pull} pour les réconcilier{force}.",
            _ => $"Push refusé ({reason})."
        };
    }

    private sealed record PushTargetModel(string Remote, string Destination, bool Publish);

    private sealed record PushAdviceModel(string Branch, string Pull, bool ForceOffered);
}

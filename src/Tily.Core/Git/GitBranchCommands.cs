namespace Tily.Core.Git;

public static class GitBranchCommands
{
    public const string BranchTarget = "branch";
    public const string RemoteTarget = "remote";
    public const string CommitTarget = "commit";

    public static GitOutcomeModel Create(GitRepository repository, string? name, string? start, bool checkout)
    {
        var branch = GitNames.RequireBranchName(repository, name);
        if (repository.RefValue($"refs/heads/{branch}") is not null)
        {
            throw new GitCommandException($"La branche « {branch} » existe déjà.", string.Empty);
        }

        var startPoint = string.IsNullOrWhiteSpace(start) ? null : GitNames.RequireRevision(start);
        if (startPoint is not null)
        {
            repository.RequireCommit(startPoint);
        }

        var (before, branchBefore) = repository.HeadAndBranch();
        var arguments = checkout ? new List<string> { "switch", "-c", branch } : ["branch", branch];
        if (startPoint is not null)
        {
            arguments.Add(startPoint);
        }

        GitRepository.Require(repository.Run([.. arguments]), $"La création de la branche « {branch} » a échoué.");
        var record = new GitUndoRecordModel
        {
            Kind = GitUndoKind.BranchCreate,
            Label = $"Création de la branche « {branch} »",
            RefName = branch,
            RefTarget = repository.Resolve($"refs/heads/{branch}"),
            HeadBefore = checkout ? before : null,
            BranchBefore = checkout ? branchBefore : null,
            BranchAfter = checkout ? branch : null
        };
        return new GitOutcomeModel(checkout ? $"Checkout de la nouvelle branche « {branch} »." : $"Branche « {branch} » créée.", Undo: record);
    }

    public static GitOutcomeModel Switch(GitRepository repository, string? reference, string? target)
    {
        var name = GitNames.RequireRevision(reference);
        repository.RequireNoOperation();
        var (before, branchBefore) = repository.HeadAndBranch();
        string? created = null;
        string label;
        GitOutputModel output;
        switch (target)
        {
            case BranchTarget when name == branchBefore:
                return new GitOutcomeModel($"Déjà sur « {name} ».");
            case BranchTarget:
                label = name;
                output = repository.Run("switch", name);
                break;
            case RemoteTarget:
                var remote = GitRefsReader.RemoteOf(repository.Remotes(), name) ?? throw new GitCommandException($"Branche distante inconnue : « {name} ».", string.Empty);
                label = name[(remote.Length + 1)..];
                if (label == branchBefore)
                {
                    return new GitOutcomeModel($"Déjà sur « {label} ».");
                }

                created = repository.RefValue($"refs/heads/{label}") is null ? label : null;
                output = created is null ? repository.Run("switch", label) : repository.Run("switch", "-c", label, "--track", $"refs/remotes/{name}");
                break;
            case CommitTarget:
                var sha = repository.RequireCommit(name);
                label = GitRepository.Short(sha);
                output = repository.Run("switch", "--detach", sha);
                break;
            default:
                throw new GitCommandException($"Cible de checkout inconnue : {target}.", string.Empty);
        }

        GitRepository.Require(output, $"Checkout de « {label} » impossible.");
        var (after, branchAfter) = repository.HeadAndBranch();
        var record = new GitUndoRecordModel
        {
            Kind = GitUndoKind.Switch,
            Label = $"Checkout de « {label} »",
            HeadBefore = before,
            HeadAfter = after,
            BranchBefore = branchBefore,
            BranchAfter = branchAfter,
            RefName = created
        };
        return new GitOutcomeModel(target == CommitTarget ? $"Checkout de {label} : HEAD détachée." : $"Checkout de « {label} » terminé.", Undo: record);
    }

    public static GitOutcomeModel Rename(GitRepository repository, string? name, string? newName)
    {
        var from = GitNames.RequireBranchName(repository, name);
        var to = GitNames.RequireBranchName(repository, newName);
        if (from == to)
        {
            return new GitOutcomeModel("Nom inchangé.");
        }

        var caseOnly = string.Equals(from, to, StringComparison.OrdinalIgnoreCase);
        if (!caseOnly && repository.RefValue($"refs/heads/{to}") is not null)
        {
            throw new GitCommandException($"La branche « {to} » existe déjà.", string.Empty);
        }

        GitRepository.Require(repository.Run("branch", caseOnly ? "-M" : "-m", from, to), $"Le renommage de « {from} » a échoué.");
        return new GitOutcomeModel($"Branche « {from} » renommée en « {to} ».", Undo: new GitUndoRecordModel { Kind = GitUndoKind.BranchRename, Label = $"Renommage de « {from} » en « {to} »", RefName = from, NewName = to });
    }

    public static GitOutcomeModel Delete(GitRepository repository, string? name, bool force, bool confirmed)
    {
        var branch = GitNames.RequireBranchName(repository, name);
        if (branch == repository.CurrentBranch())
        {
            throw new GitCommandException("Impossible de supprimer la branche courante : faites d’abord le checkout d’une autre branche.", string.Empty);
        }

        var target = repository.Resolve($"refs/heads/{branch}") ?? throw new GitCommandException($"La branche « {branch} » n’existe plus.", string.Empty);
        var upstream = GitRepository.ValueOf(repository.Run("rev-parse", "--abbrev-ref", $"{branch}@{{upstream}}"));
        if (force)
        {
            GitPaths.RequireConfirmation(confirmed);
        }
        else
        {
            var reference = upstream is null ? repository.HeadSha() : $"refs/remotes/{upstream}";
            if (reference is null || !repository.IsAncestor(target, reference))
            {
                throw new GitCommandException($"La branche « {branch} » a des commits sans merge.", "Ses commits ne sont pas dans la branche de référence. Confirmez pour la supprimer quand même.", GitFailureCode.NotMerged);
            }
        }

        GitRepository.Require(repository.Run("branch", force ? "-D" : "-d", branch), $"La suppression de « {branch} » a échoué.");
        return new GitOutcomeModel($"Branche « {branch} » supprimée.", Undo: new GitUndoRecordModel { Kind = GitUndoKind.BranchDelete, Label = $"Suppression de la branche « {branch} »", RefName = branch, RefTarget = target, Upstream = upstream });
    }
}

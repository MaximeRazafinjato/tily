namespace Tily.Core.Git;

public static class GitChangeCommands
{
    private const char Separator = '\u001f';
    private const int MaxMarkerScanBytes = 10 * 1024 * 1024;
    private static readonly string[] ConflictMarkers = ["<<<<<<<", ">>>>>>>"];

    public static GitOutcomeModel Stage(GitRepository repository, IReadOnlyList<string> files)
    {
        if (files.Count == 0)
        {
            GitRepository.Require(repository.Run("add", "-A"), "Le stage a échoué.");
            return new GitOutcomeModel("Stage de toutes les modifications.");
        }

        GitPaths.Run(repository, "Le stage a échoué.", files, "add");
        return new GitOutcomeModel(files.Count == 1 ? $"Stage : {files[0]}" : $"Stage de {files.Count} fichiers.");
    }

    public static GitOutcomeModel Unstage(GitRepository repository, IReadOnlyList<string> files)
    {
        const string failure = "L’unstage a échoué.";
        var unborn = repository.HeadSha() is null;
        if (files.Count == 0)
        {
            GitRepository.Require(unborn ? repository.Run("rm", "-r", "-q", "--cached", "--", ".") : repository.Run("reset", "-q"), failure);
            return new GitOutcomeModel("Unstage de toutes les modifications.");
        }

        if (unborn)
        {
            GitPaths.Run(repository, failure, files, "rm", "-q", "--cached");
        }
        else
        {
            GitPaths.Run(repository, failure, files, "restore", "--staged");
        }

        return new GitOutcomeModel(files.Count == 1 ? $"Unstage : {files[0]}" : $"Unstage de {files.Count} fichiers.");
    }

    public static GitOutcomeModel Discard(GitRepository repository, IReadOnlyList<string> files, bool confirmed)
    {
        GitPaths.RequireConfirmation(confirmed);
        var unstaged = repository.Status(int.MaxValue).Unstaged;
        var wanted = files.ToHashSet(StringComparer.Ordinal);
        var changes = files.Count == 0 ? unstaged : unstaged.Where(change => wanted.Contains(change.Path)).ToList();
        if (changes.Count == 0)
        {
            throw new GitCommandException("Aucune modification à abandonner.", string.Empty);
        }

        var blobs = GitPaths.Hash(repository, changes.Select(change => change.Path).Where(path => File.Exists(repository.FullPath(path))).ToList(), true);
        var tracked = changes.Where(change => change.Kind != GitChangeKind.Untracked).Select(change => change.Path).ToList();
        if (tracked.Count > 0)
        {
            GitPaths.Run(repository, "L’abandon des modifications a échoué.", tracked, "restore", "--worktree");
        }

        foreach (var change in changes.Where(change => change.Kind == GitChangeKind.Untracked))
        {
            File.Delete(repository.FullPath(change.Path));
        }

        var after = GitPaths.Hash(repository, tracked.Where(path => File.Exists(repository.FullPath(path))).ToList(), false);
        var single = changes.Count == 1 ? changes[0].Path : null;
        var record = new GitUndoRecordModel
        {
            Kind = GitUndoKind.Discard,
            Label = single is null ? $"Abandon des modifications de {changes.Count} fichiers" : $"Abandon des modifications de « {single} »",
            Files = changes.Select(change => new GitDiscardedFileModel(change.Path, blobs.GetValueOrDefault(change.Path), after.GetValueOrDefault(change.Path))).ToList()
        };
        return new GitOutcomeModel(single is null ? $"Modifications abandonnées dans {changes.Count} fichiers." : $"Modifications abandonnées : {single}", Undo: record);
    }

    public static GitOutcomeModel Commit(GitRepository repository, string? message, bool amend)
    {
        var text = (message ?? string.Empty).Trim();
        if (repository.Operation() is not null)
        {
            throw new GitCommandException("Une opération est en cours : terminez-la ou annulez-la avant de committer.", string.Empty);
        }

        var stagedRead = amend ? null : Task.Run(repository.HasStagedChanges);
        var branchRead = Task.Run(repository.CurrentBranch);
        var before = repository.HeadSha();
        if (stagedRead is not null && !stagedRead.GetAwaiter().GetResult())
        {
            throw new GitCommandException("Aucune modification staged : il faut au moins un fichier staged pour committer.", string.Empty);
        }

        if (!amend && text.Length == 0)
        {
            throw new GitCommandException("Le message du commit est vide.", string.Empty);
        }

        if (amend && before is null)
        {
            throw new GitCommandException("Aucun commit : amend impossible.", string.Empty);
        }

        var arguments = new List<string> { "commit" };
        if (amend)
        {
            arguments.Add("--amend");
        }

        arguments.AddRange(text.Length > 0 ? ["-F", "-"] : ["--no-edit"]);
        GitRepository.Require(repository.Run(new GitRunOptionsModel(Input: text.Length > 0 ? $"{text}\n" : null), [.. arguments]), amend ? "L’amend a échoué." : "Le commit a échoué.");
        var created = repository.Run("log", "-1", "--no-show-signature", "--format=%H%x1f%s", "HEAD").Output.Trim().Split(Separator, 2);
        if (created.Length < 2)
        {
            throw new GitCommandException("Le commit n’a pas été créé.", string.Empty);
        }

        var (after, subject) = (created[0], created[1]);
        var record = new GitUndoRecordModel
        {
            Kind = amend ? GitUndoKind.Amend : GitUndoKind.Commit,
            Label = amend ? "Amend du dernier commit" : $"Commit « {subject} »",
            HeadBefore = before,
            HeadAfter = after,
            BranchAfter = branchRead.GetAwaiter().GetResult()
        };
        return new GitOutcomeModel(amend ? $"Amend terminé : {GitRepository.Short(after)} « {subject} »." : $"Commit {GitRepository.Short(after)} créé : « {subject} ».", Undo: record);
    }

    public static GitOutcomeModel Ignore(GitRepository repository, IReadOnlyList<string> files)
    {
        if (files.Count == 0)
        {
            throw new GitCommandException("Aucun fichier à ignorer.", string.Empty);
        }

        var ignoreFile = repository.FullPath(".gitignore");
        var content = File.Exists(ignoreFile) ? File.ReadAllText(ignoreFile) : string.Empty;
        var newline = content.Contains("\r\n", StringComparison.Ordinal) ? "\r\n" : "\n";
        var existing = content.Split('\n').Select(line => line.TrimEnd('\r')).ToHashSet(StringComparer.Ordinal);
        var patterns = files.Select(file => IgnorePattern(GitNames.RequireRelativePath(file))).Distinct().Where(pattern => !existing.Contains(pattern)).ToList();
        if (patterns.Count > 0)
        {
            var separator = content.Length == 0 || content.EndsWith('\n') ? string.Empty : newline;
            File.AppendAllText(ignoreFile, separator + string.Concat(patterns.Select(pattern => pattern + newline)));
        }

        return new GitOutcomeModel(files.Count == 1 ? $"« {files[0]} » ajouté au .gitignore." : $"{files.Count} fichiers ajoutés au .gitignore.");
    }

    public static GitOutcomeModel Resolve(GitRepository repository, IReadOnlyList<string> files, bool confirmed)
    {
        if (files.Count == 0)
        {
            throw new GitCommandException("Aucun fichier à marquer résolu.", string.Empty);
        }

        var present = files.Where(path => File.Exists(repository.FullPath(path))).ToList();
        var marked = confirmed ? null : present.FirstOrDefault(path => HasConflictMarkers(repository.FullPath(path)));
        if (marked is not null)
        {
            throw new GitCommandException($"« {marked} » contient encore des marqueurs de conflit.", "Vérifiez le fichier dans l’éditeur, ou confirmez pour le marquer résolu tel quel.", GitFailureCode.ConflictMarkers);
        }

        if (present.Count > 0)
        {
            GitPaths.Run(repository, "Le marquage du conflit a échoué.", present, "add");
        }

        var absent = files.Except(present).ToList();
        if (absent.Count > 0)
        {
            GitPaths.Run(repository, "Le marquage du conflit a échoué.", absent, "rm", "-q", "--cached");
        }

        return new GitOutcomeModel(files.Count == 1 ? $"« {files[0]} » marqué résolu." : $"{files.Count} fichiers marqués résolus.");
    }

    public static GitOutcomeModel Continue(GitRepository repository, GitUndoRecordModel? pending)
    {
        var operation = repository.Operation() ?? throw new GitCommandException("Aucune opération en cours.", string.Empty);
        if (repository.Status().Conflicts.Count > 0)
        {
            throw new GitCommandException("Des fichiers sont encore en conflit : marquez-les résolus avant de terminer.", string.Empty);
        }

        var output = repository.Run(GitOperationNames.Command(operation), "--continue");
        if (repository.Operation() is not null)
        {
            return repository.Status().Conflicts.Count > 0
                ? new GitOutcomeModel($"{GitOperationNames.Label(operation)} : nouveaux conflits à résoudre.", true)
                : throw new GitCommandException($"{GitOperationNames.Label(operation)} : impossible de continuer.", output.Details);
        }

        GitRepository.Require(output, $"{GitOperationNames.Label(operation)} : impossible de terminer.");
        var head = repository.HeadSha();
        var record = pending is { Pending: true } && head is not null
            ? pending with { Pending = false, HeadAfter = head, BranchAfter = repository.CurrentBranch(), Published = repository.IsPublished(head) }
            : null;
        return new GitOutcomeModel(GitOperationNames.Finished(operation), Undo: record, ClearUndo: record is null);
    }

    public static GitOutcomeModel Abort(GitRepository repository, bool confirmed)
    {
        GitPaths.RequireConfirmation(confirmed);
        var operation = repository.Operation() ?? throw new GitCommandException("Aucune opération en cours.", string.Empty);
        GitRepository.Require(repository.Run(GitOperationNames.Command(operation), "--abort"), $"{GitOperationNames.Label(operation)} : impossible d’annuler.");
        return new GitOutcomeModel(GitOperationNames.Aborted(operation), ClearUndo: true);
    }

    private static string IgnorePattern(string file) =>
        "/" + string.Concat(file.Select(character => character is '*' or '?' or '[' or '\\' ? $"\\{character}" : character.ToString()));

    private static bool HasConflictMarkers(string path)
    {
        if (new FileInfo(path).Length > MaxMarkerScanBytes)
        {
            return false;
        }

        return File.ReadLines(path).Any(line => ConflictMarkers.Any(marker => line.StartsWith(marker, StringComparison.Ordinal) && (line.Length == marker.Length || line[marker.Length] == ' ')));
    }
}

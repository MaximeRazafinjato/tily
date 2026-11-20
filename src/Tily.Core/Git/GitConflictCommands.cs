using System.Text;
using Tily.Core.Files;

namespace Tily.Core.Git;

public static class GitConflictCommands
{
    private const string Crlf = "\r\n";
    private const string Lf = "\n";
    private const int OursStage = 2;
    private const int TheirsStage = 3;
    private const string Failure = "Le marquage du conflit a échoué.";
    private static readonly UTF8Encoding Utf8WithoutBom = new(false);

    public static GitOutcomeModel Write(GitRepository repository, string? file, string? content, string? version, bool confirmed)
    {
        var path = GitNames.RequireRelativePath(file);
        GitConflictReader.RequireConflict(repository, path);
        var text = (content ?? string.Empty).Replace(Crlf, Lf, StringComparison.Ordinal);
        var fullPath = repository.FullPath(path);
        if (!confirmed && GitConflictReader.VersionOf(fullPath) != version)
        {
            throw new GitCommandException($"« {path} » a été modifié sur le disque depuis l’ouverture du résolveur.", "Confirmez pour le remplacer par le résultat de la résolution.", GitFailureCode.FileChanged);
        }

        if (!confirmed && GitChangeCommands.ContainsConflictMarkers(text.Split('\n')))
        {
            throw new GitCommandException($"Le résultat de « {path} » contient encore des marqueurs de conflit.", "Vérifiez le résultat, ou confirmez pour l’enregistrer tel quel.", GitFailureCode.ConflictMarkers);
        }

        var (encoding, current) = TextFileWriter.Detect(File.Exists(fullPath) ? File.ReadAllBytes(fullPath) : []);
        var target = encoding ?? Utf8WithoutBom;
        var output = TextFileWriter.WithLineEndings(text, current.Contains(Crlf, StringComparison.Ordinal) ? Crlf : Lf);
        if (target == Encoding.Latin1 && TextFileWriter.FirstOutsideLatin1(output) is { } invalid)
        {
            throw new GitCommandException($"« {path} » est encodé en Latin-1 : le caractère « {invalid} » ne peut pas y être enregistré.", string.Empty);
        }

        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
        File.WriteAllBytes(fullPath, [.. target.GetPreamble(), .. target.GetBytes(output)]);
        GitPaths.Run(repository, Failure, [path], "add");
        return new GitOutcomeModel($"Conflit de « {path} » résolu.");
    }

    public static GitOutcomeModel Take(GitRepository repository, string? file, string? mode, bool confirmed)
    {
        GitPaths.RequireConfirmation(confirmed);
        var path = GitNames.RequireRelativePath(file);
        var resolution = Resolution(mode);
        GitConflictReader.RequireConflict(repository, path);
        var stages = GitConflictReader.Stages(repository, path);
        var kept = resolution switch
        {
            GitConflictResolution.Ours when stages.ContainsKey(OursStage) => "--ours",
            GitConflictResolution.Theirs when stages.ContainsKey(TheirsStage) => "--theirs",
            _ => null
        };
        if (kept is not null)
        {
            GitPaths.Run(repository, Failure, [path], "checkout", kept);
            GitPaths.Run(repository, Failure, [path], "add");
            return new GitOutcomeModel(resolution == GitConflictResolution.Ours ? $"« {path} » : version courante gardée." : $"« {path} » : version entrante gardée.");
        }

        var fullPath = repository.FullPath(path);
        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
        }

        GitPaths.Run(repository, Failure, [path], "rm", "-q", "--cached");
        return new GitOutcomeModel($"« {path} » supprimé.");
    }

    private static GitConflictResolution Resolution(string? mode) => mode switch
    {
        "ours" => GitConflictResolution.Ours,
        "theirs" => GitConflictResolution.Theirs,
        "delete" => GitConflictResolution.Delete,
        _ => throw new GitCommandException($"Résolution de conflit inconnue : « {mode} ».", string.Empty)
    };
}

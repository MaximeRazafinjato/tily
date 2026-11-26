using System.Security.Cryptography;
using Tily.Core.Files;

namespace Tily.Core.Git;

public static class GitConflictReader
{
    public const int MaxBytes = FilePreview.MaxBytes;

    private const int BaseStage = 1;
    private const int OursStage = 2;
    private const int TheirsStage = 3;
    private const string EmptyBlob = "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391";
    private static readonly string[] DiffOptions = ["diff", "--no-color", "--no-ext-diff", "--no-textconv", "--text", "-U0"];

    private sealed record StageText(string Blob, IReadOnlyList<string> Lines, bool FinalNewline);

    public static GitConflictFileModel Read(GitRepository repository, string? file)
    {
        var path = GitNames.RequireRelativePath(file);
        var conflict = RequireConflict(repository, path);
        var stages = Stages(repository, path);
        var sides = GitConflictSides.Read(repository);
        var version = VersionOf(repository.FullPath(path));
        var model = new GitConflictFileModel(path, conflict.Kind, GitConflictView.Presence, sides, stages.ContainsKey(OursStage), stages.ContainsKey(TheirsStage), [], true, PreviewTypes.LanguageOf(path), version);
        if (!model.OursExists || !model.TheirsExists)
        {
            return model;
        }

        var blobs = new[] { BaseStage, OursStage, TheirsStage }.Select(stage => stages.GetValueOrDefault(stage)).ToList();
        var contents = blobs.Select(blob => blob is null ? [] : repository.ReadBytes("cat-file", "blob", blob)).ToList();
        if (contents.Any(bytes => bytes.Length > MaxBytes))
        {
            return model with { View = GitConflictView.TooLarge };
        }

        var texts = new List<StageText>();
        for (var index = 0; index < contents.Count; index++)
        {
            var (encoding, text) = TextFileWriter.Detect(contents[index]);
            if (encoding is null)
            {
                return model with { View = GitConflictView.Binary };
            }

            texts.Add(Split(blobs[index] ?? EmptyBlob, text));
        }

        var (baseText, ours, theirs) = (texts[0], texts[1], texts[2]);
        var oursDiff = Task.Run(() => Diff(repository, baseText.Blob, ours.Blob));
        var theirsHunks = Diff(repository, baseText.Blob, theirs.Blob);
        var chunks = GitMergeAligner.Merge(baseText.Lines, ours.Lines, theirs.Lines, oursDiff.GetAwaiter().GetResult(), theirsHunks);
        return model with { View = GitConflictView.Text, Chunks = chunks, FinalNewline = ours.FinalNewline || theirs.FinalNewline };
    }

    public static GitConflictModel RequireConflict(GitRepository repository, string path) =>
        repository.Status(int.MaxValue).Conflicts.FirstOrDefault(conflict => conflict.Path == path)
        ?? throw new GitCommandException($"« {path} » n’est plus en conflit.", string.Empty);

    public static IReadOnlyDictionary<int, string> Stages(GitRepository repository, string path)
    {
        var output = repository.Read(new GitRunOptionsModel(LiteralPaths: true), "ls-files", "-u", "-z", "--", path);
        var stages = new Dictionary<int, string>();
        foreach (var entry in output.Split('\0', StringSplitOptions.RemoveEmptyEntries))
        {
            var fields = entry.Split('\t', 2)[0].Split(' ');
            if (fields.Length == 3 && int.TryParse(fields[2], out var stage))
            {
                stages[stage] = fields[1];
            }
        }

        return stages;
    }

    public static string? VersionOf(string fullPath) =>
        File.Exists(fullPath) ? Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(fullPath))) : null;

    private static StageText Split(string blob, string text)
    {
        var lines = text.Split('\n').Select(line => line.EndsWith('\r') ? line[..^1] : line).ToList();
        var finalNewline = text.EndsWith('\n');
        if (finalNewline || text.Length == 0)
        {
            lines.RemoveAt(lines.Count - 1);
        }

        return new StageText(blob, lines, finalNewline);
    }

    private static IReadOnlyList<GitLineHunkModel> Diff(GitRepository repository, string from, string to) =>
        from == to ? [] : GitMergeAligner.ParseHunks(repository.Read([.. DiffOptions, from, to]));
}

using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;

namespace Tily.Core.Git;

[JsonConverter(typeof(JsonStringEnumConverter<GitDiffSource>))]
public enum GitDiffSource
{
    [JsonStringEnumMemberName("unstaged")] Unstaged,
    [JsonStringEnumMemberName("staged")] Staged,
    [JsonStringEnumMemberName("commit")] Commit
}

public sealed record GitDiffRequestModel(GitDiffSource Source, string Path, string? OldPath, string? Commit, bool Untracked);

public static class GitDiffReader
{
    public const int MaxUntrackedBytes = 2 * 1024 * 1024;
    public const int MaxCommitFiles = 5000;

    private const int BinaryProbeBytes = 8000;
    private const char Separator = '\u001f';
    private const char UndecodedCharacter = '\uFFFD';
    private static readonly string[] DiffOptions = ["--no-ext-diff", "--no-color", "--src-prefix=a/", "--dst-prefix=b/", "-U3", "-M"];

    public static GitDiffModel Read(GitRepository repository, GitDiffRequestModel request)
    {
        var path = GitNames.RequireRelativePath(request.Path);
        var oldPath = request.OldPath is null ? null : GitNames.RequireRelativePath(request.OldPath);
        if (request.Source == GitDiffSource.Unstaged && request.Untracked)
        {
            return ReadUntracked(repository, path);
        }

        string[] paths = oldPath is null ? [path] : [oldPath, path];
        var raw = request.Source == GitDiffSource.Commit
            ? ReadCommitDiff(repository, request.Commit, paths)
            : repository.Read(new GitRunOptionsModel(LiteralPaths: true), WorkingArguments(request.Source, paths));
        var diff = Copyable(GitDiffParser.Parse(path, oldPath, raw), raw);
        return request.Source == GitDiffSource.Commit || oldPath is not null ? diff : Selectable(diff, raw);
    }

    public static string? ReadRaw(GitRepository repository, GitDiffSource source, string path, bool untracked)
    {
        if (!untracked)
        {
            return repository.Read(new GitRunOptionsModel(LiteralPaths: true), WorkingArguments(source, [path]));
        }

        var info = UntrackedFile(repository, path);
        var bytes = info.Length > MaxUntrackedBytes ? null : File.ReadAllBytes(info.FullName);
        return bytes is null || IsBinary(bytes) ? null : UntrackedDiff(path, Encoding.UTF8.GetString(bytes));
    }

    public static string Fingerprint(string diff) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(diff)));

    public static string UntrackedDiff(string path, string content)
    {
        var body = content.EndsWith('\n') ? content[..^1] : content;
        var lines = body.Length == 0 ? [] : body.Split('\n');
        var tab = path.Contains(' ') ? "\t" : string.Empty;
        var builder = new StringBuilder($"diff --git a/{path} b/{path}\nnew file mode 100644\n--- /dev/null\n+++ b/{path}{tab}\n@@ -0,0 +1,{lines.Length} @@\n");
        foreach (var line in lines)
        {
            builder.Append('+').Append(line).Append('\n');
        }

        if (lines.Length > 0 && !content.EndsWith('\n'))
        {
            builder.Append("\\ No newline at end of file\n");
        }

        return builder.ToString();
    }

    private static string[] WorkingArguments(GitDiffSource source, string[] paths) =>
        source == GitDiffSource.Staged ? ["diff", "--cached", .. DiffOptions, "--", .. paths] : ["diff", .. DiffOptions, "--", .. paths];

    private static GitDiffModel Copyable(GitDiffModel diff, string raw) =>
        diff.Binary || diff.Truncated || diff.Hunks.Count == 0 || raw.Contains(UndecodedCharacter) ? diff : diff with { Patch = raw };

    private static GitDiffModel Selectable(GitDiffModel diff, string raw) =>
        diff.Binary || diff.Hunks.Count == 0 ? diff : diff with { Fingerprint = Fingerprint(raw) };

    public static GitCommitDetailsModel ReadCommit(GitRepository repository, string? commit)
    {
        var revision = CommitRevision(commit);
        var filesRead = Task.Run(() => repository.Read("diff-tree", "-r", "-M", "--root", "--diff-merges=first-parent", "--no-commit-id", "--name-status", "-z", revision));
        var show = repository.Run("show", "-s", "--no-show-signature", "--format=%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%B", revision);
        if (!show.Succeeded)
        {
            throw new GitCommandException($"Commit introuvable : {commit}.", string.Empty);
        }

        var fields = show.Output.Split(Separator, 6);
        if (fields.Length < 6)
        {
            throw new GitCommandException($"Commit illisible : {commit}.", string.Empty);
        }

        var files = ParseNameStatus(filesRead.GetAwaiter().GetResult());
        return new GitCommitDetailsModel(fields[0].Trim(), GitHistoryReader.Parents(fields[1]), fields[2], fields[3], long.TryParse(fields[4], out var date) ? date : 0, fields[5].TrimEnd(), files);
    }

    public static IReadOnlyList<GitFileChangeModel> ParseNameStatus(string output)
    {
        var tokens = output.Split('\0');
        var files = new List<GitFileChangeModel>();
        for (var index = 0; index < tokens.Length && files.Count < MaxCommitFiles; index++)
        {
            var status = tokens[index].Trim('\n');
            if (status.Length == 0)
            {
                continue;
            }

            var kind = status[0] switch
            {
                'A' => GitChangeKind.Added,
                'D' => GitChangeKind.Deleted,
                'R' => GitChangeKind.Renamed,
                'C' => GitChangeKind.Copied,
                'T' => GitChangeKind.TypeChanged,
                _ => GitChangeKind.Modified
            };
            if (kind is GitChangeKind.Renamed or GitChangeKind.Copied && index + 2 < tokens.Length)
            {
                files.Add(new GitFileChangeModel(tokens[index + 2], tokens[index + 1], kind));
                index += 2;
            }
            else if (index + 1 < tokens.Length)
            {
                files.Add(new GitFileChangeModel(tokens[index + 1], null, kind));
                index++;
            }
        }

        return files;
    }

    private static string CommitRevision(string? commit) => $"{GitNames.RequireRevision(commit)}^{{commit}}";

    private static string ReadCommitDiff(GitRepository repository, string? commit, string[] paths)
    {
        var output = repository.Run(new GitRunOptionsModel(LiteralPaths: true), ["diff-tree", "-p", "-r", "--root", "--diff-merges=first-parent", "--no-commit-id", .. DiffOptions, CommitRevision(commit), "--", .. paths]);
        return output.Succeeded ? output.Output : throw new GitCommandException($"Commit introuvable : {commit}.", output.Details);
    }

    private static FileInfo UntrackedFile(GitRepository repository, string path)
    {
        var info = new FileInfo(repository.FullPath(path));
        return info.Exists ? info : throw new GitCommandException($"Le fichier n’existe plus : {path}", string.Empty);
    }

    private static bool IsBinary(byte[] bytes) => bytes.AsSpan(0, Math.Min(bytes.Length, BinaryProbeBytes)).Contains((byte)0);

    private static GitDiffModel ReadUntracked(GitRepository repository, string path)
    {
        var info = UntrackedFile(repository, path);
        const string untracked = "Nouveau fichier non suivi";
        if (info.Length > MaxUntrackedBytes)
        {
            return new GitDiffModel(path, null, false, true, [untracked, $"Fichier trop volumineux pour être affiché ({info.Length / 1024} Kio)."], []);
        }

        var bytes = File.ReadAllBytes(info.FullName);
        if (IsBinary(bytes))
        {
            return new GitDiffModel(path, null, true, false, [untracked, "Fichier binaire : contenu non affiché"], []);
        }

        var raw = Encoding.UTF8.GetString(bytes);
        var text = raw.Replace("\r\n", "\n");
        var content = text.EndsWith('\n') ? text[..^1] : text;
        var lines = content.Length == 0 ? [] : content.Split('\n');
        var shown = lines.Take(GitDiffParser.MaxLines).Select((line, index) => new GitDiffLineModel(GitDiffLineKind.Added, null, index + 1, line)).ToList();
        var hunks = shown.Count == 0 ? [] : new List<GitDiffHunkModel> { new($"@@ -0,0 +1,{lines.Length} @@", shown) };
        var patch = UntrackedDiff(path, raw);
        var diff = new GitDiffModel(path, null, false, lines.Length > shown.Count, [untracked], hunks, hunks.Count == 0 ? null : Fingerprint(patch));
        return Copyable(diff, patch);
    }
}

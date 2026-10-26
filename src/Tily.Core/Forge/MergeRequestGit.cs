using System.Globalization;
using Tily.Core.Git;

namespace Tily.Core.Forge;

public interface IMergeRequestGit
{
    string Root { get; }

    string? CurrentBranch();

    IReadOnlyList<string> LocalBranches();

    IReadOnlyList<string> OriginBranches();

    string? OriginDefaultBranch();

    BranchPublicationModel Publication(string branch);

    IReadOnlyList<MergeRequestCommitModel> Commits(string source, string target);

    string? Template(ForgeKind kind);

    void Push(string branch);
}

public sealed class MergeRequestGit : IMergeRequestGit
{
    public const int CommitLimit = 100;
    private const int TemplateMaxBytes = 64 * 1024;
    private const string HeadsPrefix = "refs/heads/";
    private const string OriginPrefix = "refs/remotes/origin/";
    private const string OriginHead = "HEAD";
    private const char FieldSeparator = '\u001f';
    private const char RecordSeparator = '\u001e';

    private static readonly string[] GitHubTemplates =
    [
        Path.Combine(".github", "pull_request_template.md"),
        "pull_request_template.md",
        Path.Combine("docs", "pull_request_template.md")
    ];

    private static readonly string[] GitLabTemplates = [Path.Combine(".gitlab", "merge_request_templates", "Default.md")];

    private readonly GitRepository _repository;

    public MergeRequestGit(GitRepository repository) => _repository = repository;

    public string Root => _repository.Root;

    public static IMergeRequestGit Open(string path)
    {
        try
        {
            return new MergeRequestGit(GitRepository.Open(new GitRunner(), path));
        }
        catch (GitCommandException exception)
        {
            throw new ForgeException(exception.Message);
        }
    }

    public string? CurrentBranch() => _repository.CurrentBranch();

    public IReadOnlyList<string> LocalBranches() => Refs(HeadsPrefix);

    public IReadOnlyList<string> OriginBranches() => Refs(OriginPrefix).Where(name => name != OriginHead).ToList();

    public string? OriginDefaultBranch()
    {
        var target = GitRepository.ValueOf(_repository.Run("symbolic-ref", "-q", $"{OriginPrefix}{OriginHead}"));
        return target is not null && target.StartsWith(OriginPrefix, StringComparison.Ordinal) ? target[OriginPrefix.Length..] : null;
    }

    public BranchPublicationModel Publication(string branch)
    {
        var local = _repository.RefValue($"{HeadsPrefix}{branch}") is not null;
        var published = _repository.RefValue($"{OriginPrefix}{branch}") is not null;
        if (!local || !published)
        {
            return new BranchPublicationModel(local, published, 0);
        }

        var count = GitRepository.ValueOf(_repository.Run("rev-list", "--count", $"{OriginPrefix}{branch}..{HeadsPrefix}{branch}"));
        return new BranchPublicationModel(true, true, int.TryParse(count, NumberStyles.None, CultureInfo.InvariantCulture, out var ahead) ? ahead : 0);
    }

    public IReadOnlyList<MergeRequestCommitModel> Commits(string source, string target)
    {
        var sourceRef = FirstExisting($"{HeadsPrefix}{source}", $"{OriginPrefix}{source}");
        var targetRef = FirstExisting($"{OriginPrefix}{target}", $"{HeadsPrefix}{target}");
        if (sourceRef is null || targetRef is null)
        {
            return [];
        }

        var output = _repository.Run(
            "log", "--no-merges", "--reverse", $"--max-count={CommitLimit}", $"--format=%s{FieldSeparator}%b{RecordSeparator}", $"{targetRef}..{sourceRef}", "--");
        if (!output.Succeeded)
        {
            return [];
        }

        return output.Output.Split(RecordSeparator)
            .Select(record => record.TrimStart('\n', '\r'))
            .Where(record => record.Length > 0)
            .Select(record =>
            {
                var separator = record.IndexOf(FieldSeparator);
                return separator < 0
                    ? new MergeRequestCommitModel(record.Trim(), string.Empty)
                    : new MergeRequestCommitModel(record[..separator].Trim(), record[(separator + 1)..].Replace("\r\n", "\n").Trim());
            })
            .ToList();
    }

    public string? Template(ForgeKind kind)
    {
        foreach (var relative in kind == ForgeKind.GitHub ? GitHubTemplates : GitLabTemplates)
        {
            var path = Path.Combine(Root, relative);
            try
            {
                var file = new FileInfo(path);
                if (file.Exists && file.Length <= TemplateMaxBytes)
                {
                    return File.ReadAllText(path);
                }
            }
            catch (IOException)
            {
            }
            catch (UnauthorizedAccessException)
            {
            }
        }

        return null;
    }

    public void Push(string branch)
    {
        try
        {
            GitSyncCommands.PushBranch(_repository, branch);
        }
        catch (GitCommandException exception)
        {
            throw new ForgeException(exception.Message);
        }
    }

    private IReadOnlyList<string> Refs(string prefix)
    {
        var output = _repository.Run("for-each-ref", "--format=%(refname)", prefix.TrimEnd('/'));
        return output.Succeeded
            ? output.Output.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(name => name.StartsWith(prefix, StringComparison.Ordinal))
                .Select(name => name[prefix.Length..])
                .Order(StringComparer.OrdinalIgnoreCase)
                .ToList()
            : [];
    }

    private string? FirstExisting(params string[] references) => references.FirstOrDefault(reference => _repository.RefValue(reference) is not null);
}

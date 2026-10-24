namespace Tily.Core.Forge;

public static class MergeRequestSuggestion
{
    public static string Title(string source, IReadOnlyList<MergeRequestCommitModel> commits) =>
        commits.Count == 1 && commits[0].Subject.Trim().Length > 0 ? commits[0].Subject.Trim() : Humanize(source);

    public static string Description(IReadOnlyList<MergeRequestCommitModel> commits, string? template)
    {
        if (template is not null && template.Trim().Length > 0)
        {
            return template.Replace("\r\n", "\n").Trim();
        }

        return commits.Count switch
        {
            0 => string.Empty,
            1 => commits[0].Body.Trim(),
            _ => string.Join('\n', commits.Select(commit => $"- {commit.Subject.Trim()}"))
        };
    }

    private static string Humanize(string branch)
    {
        var name = branch[(branch.LastIndexOf('/') + 1)..].Replace('-', ' ').Replace('_', ' ').Trim();
        return name.Length == 0 ? branch : $"{char.ToUpperInvariant(name[0])}{name[1..]}";
    }
}

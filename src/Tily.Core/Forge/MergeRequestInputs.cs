namespace Tily.Core.Forge;

public static class MergeRequestInputs
{
    public const int TitleMaxLength = 255;
    public const int DescriptionMaxLength = 65536;

    public static string Noun(ForgeKind kind) => kind == ForgeKind.GitHub ? "PR" : "MR";

    public static string Reference(ForgeKind kind, int number) => kind == ForgeKind.GitHub ? $"#{number}" : $"!{number}";

    public static MergeRequestInputModel Normalize(MergeRequestInputModel? input)
    {
        if (input is null)
        {
            throw new ForgeException("Formulaire de MR/PR manquant.");
        }

        var source = RequireBranch(input.SourceBranch, "source");
        var target = RequireBranch(input.TargetBranch, "cible");
        if (source == target)
        {
            throw new ForgeException("La branche source et la branche cible sont identiques.");
        }

        var title = input.Title?.Trim() ?? string.Empty;
        if (title.Length == 0)
        {
            throw new ForgeException("Le titre est obligatoire.");
        }

        if (title.Length > TitleMaxLength)
        {
            throw new ForgeException($"Titre trop long : {TitleMaxLength} caractères au plus.");
        }

        var description = Description(input.Description);
        if (description.Length > DescriptionMaxLength)
        {
            throw new ForgeException($"Description trop longue : {DescriptionMaxLength} caractères au plus.");
        }

        var assignee = input.Assignee?.Trim();
        return new MergeRequestInputModel(
            source,
            target,
            title,
            description,
            Distinct(input.Reviewers),
            string.IsNullOrEmpty(assignee) ? null : assignee,
            Distinct(input.Labels),
            input.Draft);
    }

    public static string Description(string? description) => (description ?? string.Empty).Replace("\r\n", "\n").TrimEnd();

    private static string RequireBranch(string? branch, string role)
    {
        var name = branch?.Trim() ?? string.Empty;
        if (name.Length == 0)
        {
            throw new ForgeException($"Choisissez la branche {role}.");
        }

        return name.StartsWith('-') || name.Any(char.IsWhiteSpace)
            ? throw new ForgeException($"Nom de branche {role} invalide : « {name} ».")
            : name;
    }

    private static IReadOnlyList<string> Distinct(IReadOnlyList<string>? values) =>
        (values ?? []).Select(value => value?.Trim() ?? string.Empty).Where(value => value.Length > 0).Distinct(StringComparer.Ordinal).ToList();
}

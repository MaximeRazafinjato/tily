namespace Tily.Core.Forge;

public sealed record MergeRequestChangesModel(int Number, MergeRequestInputModel Original, MergeRequestInputModel Edited, bool Close)
{
    public bool TitleChanged => Original.Title != Edited.Title;

    public bool DescriptionChanged => Original.Description != Edited.Description;

    public bool TargetChanged => Original.TargetBranch != Edited.TargetBranch;

    public bool AssigneeChanged => Original.Assignee != Edited.Assignee;

    public bool ReviewersChanged => AddedReviewers.Count > 0 || RemovedReviewers.Count > 0;

    public bool LabelsChanged => !Original.Labels.ToHashSet(StringComparer.Ordinal).SetEquals(Edited.Labels);

    public bool DraftChanged => Original.Draft != Edited.Draft;

    public IReadOnlyList<string> AddedReviewers => Edited.Reviewers.Except(Original.Reviewers, StringComparer.Ordinal).ToList();

    public IReadOnlyList<string> RemovedReviewers => Original.Reviewers.Except(Edited.Reviewers, StringComparer.Ordinal).ToList();

    public bool Any => Close || TitleChanged || DescriptionChanged || TargetChanged || AssigneeChanged || ReviewersChanged || LabelsChanged || DraftChanged;
}

public static class MergeRequestChanges
{
    public static MergeRequestChangesModel Between(int number, MergeRequestInputModel? original, MergeRequestInputModel? edited, bool close)
    {
        if (number <= 0)
        {
            throw new ForgeException("Numéro de MR/PR manquant.");
        }

        var before = MergeRequestInputs.Normalize(original);
        var after = MergeRequestInputs.Normalize(edited);
        return before.SourceBranch != after.SourceBranch
            ? throw new ForgeException("La branche source d’une MR/PR existante ne se modifie pas.")
            : new MergeRequestChangesModel(number, before, after, close);
    }
}

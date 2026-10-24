using Tily.Core.Forge;

namespace Tily.Core.Tests.Forge;

internal sealed class FakeMergeRequestGit : IMergeRequestGit
{
    public string Root { get; init; } = Path.GetTempPath();

    public string? Current { get; init; } = "feat/creation";

    public IReadOnlyList<string> Local { get; init; } = ["feat/creation", "main"];

    public IReadOnlyList<string> Origin { get; init; } = ["develop", "main"];

    public string? OriginDefault { get; init; } = "main";

    public Dictionary<string, BranchPublicationModel> Publications { get; } = [];

    public IReadOnlyList<MergeRequestCommitModel> CommitList { get; init; } = [new("✨ Créer des MR/PR", "Formulaire complet.")];

    public string? TemplateText { get; init; }

    public List<string> Pushed { get; } = [];

    public string? CurrentBranch() => Current;

    public IReadOnlyList<string> LocalBranches() => Local;

    public IReadOnlyList<string> OriginBranches() => Origin;

    public string? OriginDefaultBranch() => OriginDefault;

    public BranchPublicationModel Publication(string branch) =>
        Publications.TryGetValue(branch, out var publication) ? publication : new BranchPublicationModel(Local.Contains(branch), Origin.Contains(branch), 0);

    public IReadOnlyList<MergeRequestCommitModel> Commits(string source, string target) => CommitList;

    public string? Template(ForgeKind kind) => TemplateText;

    public void Push(string branch) => Pushed.Add(branch);
}

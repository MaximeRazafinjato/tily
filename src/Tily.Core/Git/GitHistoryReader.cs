namespace Tily.Core.Git;

public static class GitHistoryReader
{
    public const int PageSize = 200;
    public const int MaxCommits = 10000;

    private const char Separator = '\u001f';
    private const string CommitFormat = "--format=%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%s";
    private static readonly GitGraphRowModel SingleNode = new(0, 0, 1, []);

    public static GitHistoryModel Read(GitRepository repository, GitHistoryScope scope, int count, GitStateModel state)
    {
        var limit = Math.Clamp(count, 1, MaxCommits);
        var revisions = Revisions(scope, state);
        if (revisions.Count == 0)
        {
            return Empty(repository.Root, scope);
        }

        var pushableRead = Task.Run(() => PushableCommits(repository, state, limit));
        var arguments = new List<string> { "log", "-z", "--topo-order", "--no-show-signature", $"-n{limit + 1}", CommitFormat };
        arguments.AddRange(revisions);
        arguments.Add("--");
        var records = repository.Read(arguments.ToArray()).Split('\0', StringSplitOptions.RemoveEmptyEntries)
            .Select(record => record.Trim('\n').Split(Separator))
            .Where(fields => fields.Length >= 6)
            .ToList();
        var pushable = pushableRead.GetAwaiter().GetResult();
        var labels = Labels(state);
        var stashes = state.Stashes.Where(stash => stash.Base.Length > 0).ToLookup(stash => stash.Base, StringComparer.Ordinal);
        var entries = new List<GitCommitModel>();
        foreach (var fields in records.Take(limit))
        {
            entries.AddRange(stashes[fields[0]].Select(StashEntry));
            entries.Add(new GitCommitModel(
                fields[0],
                Parents(fields[1]),
                fields[2],
                fields[3],
                long.TryParse(fields[4], out var date) ? date : 0,
                fields[5],
                labels.TryGetValue(fields[0], out var refLabels) ? refLabels : [],
                SingleNode,
                Pushable: pushable.Contains(fields[0])));
        }

        var nodes = entries.Select(entry => new GitGraphNodeModel(entry.Sha, entry.Parents, entry.Stash)).Prepend(WorkingTreeNode(state.Head)).ToList();
        var rows = GitGraph.Layout(nodes);
        var commits = entries.Select((entry, index) => entry with { Graph = rows[index + 1] }).ToList();
        return new GitHistoryModel(repository.Root, scope, commits, records.Count > limit, rows[0]);
    }

    public static GitHistoryModel Empty(string root, GitHistoryScope scope) => new(root, scope, [], false, SingleNode);

    public static IReadOnlyList<string> Parents(string field) => field.Split(' ', StringSplitOptions.RemoveEmptyEntries);

    private static GitGraphNodeModel WorkingTreeNode(GitHeadModel head) => new(string.Empty, head.Unborn || head.Sha is null ? [] : [head.Sha], true);

    private static HashSet<string> PushableCommits(GitRepository repository, GitStateModel state, int limit)
    {
        var head = state.Head;
        if (head.Branch is null || head.Unborn || state.Remotes.Count == 0)
        {
            return [];
        }

        var tracked = state.RemoteBranches.Any(branch => branch.Name == head.Upstream);
        if (tracked && head.Ahead == 0)
        {
            return [];
        }

        var output = tracked
            ? repository.Run("rev-list", $"-n{limit}", "--ancestry-path", $"refs/remotes/{head.Upstream}..HEAD", "--")
            : repository.Run("rev-list", $"-n{limit}", "HEAD", "--not", "--remotes", "--");
        return output.Succeeded ? [.. output.Output.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)] : [];
    }

    private static GitCommitModel StashEntry(GitStashModel stash) => new(stash.Sha, [stash.Base], stash.Author, stash.Email, stash.Date, stash.Message, [], SingleNode, true);

    private static List<string> Revisions(GitHistoryScope scope, GitStateModel state)
    {
        var head = state.Head;
        if (scope == GitHistoryScope.All)
        {
            var all = new List<string> { "--branches", "--remotes", "--tags" };
            if (!head.Unborn)
            {
                all.Add("HEAD");
            }

            return all;
        }

        var current = new List<string>();
        if (!head.Unborn)
        {
            current.Add("HEAD");
        }

        if (!head.Unborn && state.RemoteBranches.Any(branch => branch.Name == head.Upstream))
        {
            current.Add($"refs/remotes/{head.Upstream}");
        }

        return current;
    }

    private static Dictionary<string, List<GitRefLabelModel>> Labels(GitStateModel state)
    {
        var labels = new Dictionary<string, List<GitRefLabelModel>>(StringComparer.Ordinal);
        void Add(string sha, GitRefLabelModel label)
        {
            if (!labels.TryGetValue(sha, out var list))
            {
                list = [];
                labels[sha] = list;
            }

            list.Add(label);
        }

        if (state.Head.Detached && state.Head.Sha is not null)
        {
            Add(state.Head.Sha, new GitRefLabelModel("HEAD", GitRefKind.Head, true, []));
        }

        var paired = new HashSet<string>(StringComparer.Ordinal);
        foreach (var branch in state.Branches.OrderByDescending(branch => branch.Current))
        {
            var remotes = state.RemoteBranches
                .Where(remote => remote.Sha == branch.Sha && (remote.Name == branch.Upstream || remote.Branch == branch.Name))
                .Select(remote => remote.Name)
                .ToList();
            paired.UnionWith(remotes);
            Add(branch.Sha, new GitRefLabelModel(branch.Name, GitRefKind.Branch, branch.Current, remotes));
        }

        foreach (var branch in state.RemoteBranches.Where(remote => !paired.Contains(remote.Name)))
        {
            Add(branch.Sha, new GitRefLabelModel(branch.Name, GitRefKind.Remote, false, []));
        }

        foreach (var tag in state.Tags)
        {
            Add(tag.Sha, new GitRefLabelModel(tag.Name, GitRefKind.Tag, false, []));
        }

        return labels;
    }
}

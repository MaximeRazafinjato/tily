using System.Collections.Concurrent;

namespace Tily.Core.Forge;

public sealed class ForgeService
{
    public const int ListLimit = 100;
    public const int BranchLimit = 20;
    public static readonly TimeSpan BranchCacheDuration = TimeSpan.FromSeconds(60);
    public static readonly TimeSpan FailureCacheDuration = TimeSpan.FromMinutes(5);

    private readonly Func<string, string> _originOf;
    private readonly Func<IReadOnlySet<string>> _gitLabHosts;
    private readonly Func<DateTimeOffset> _now;
    private readonly Func<string, IMergeRequestGit> _gitOf;
    private readonly Func<string> _baseBranch;
    private readonly IReadOnlyDictionary<ForgeKind, IForgeProvider> _providers;
    private readonly ConcurrentDictionary<string, string> _users = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, (BranchMergeRequestsModel Result, DateTimeOffset Expires)> _branches = new(StringComparer.Ordinal);

    public ForgeService(
        IForgeCommandRunner? runner = null,
        Func<string, string>? originOf = null,
        Func<IReadOnlySet<string>>? gitLabHosts = null,
        Func<DateTimeOffset>? now = null,
        Func<string, IMergeRequestGit>? gitOf = null,
        Func<string>? baseBranch = null)
    {
        var commands = runner ?? new ForgeCliRunner();
        _originOf = originOf ?? ForgeOrigin.Read;
        _gitLabHosts = gitLabHosts ?? GlabHosts.Read;
        _now = now ?? (() => DateTimeOffset.UtcNow);
        _gitOf = gitOf ?? MergeRequestGit.Open;
        _baseBranch = baseBranch ?? (() => string.Empty);
        _providers = new Dictionary<ForgeKind, IForgeProvider>
        {
            [ForgeKind.GitHub] = new GitHubProvider(commands),
            [ForgeKind.GitLab] = new GitLabProvider(commands)
        };
    }

    public ForgeRemoteModel Detect(string path)
    {
        var url = _originOf(path);
        var gitLabHosts = _gitLabHosts();
        return ForgeRemoteParser.Parse(url, gitLabHosts.Contains);
    }

    public IForgeProvider ProviderFor(ForgeRemoteModel remote) => _providers[remote.Kind];

    public MergeRequestListModel List(string path, MergeRequestStateFilter state)
    {
        var remote = Detect(path);
        var provider = ProviderFor(remote);
        var items = provider.List(remote, path, new MergeRequestQueryModel(state, ListLimit));
        return new MergeRequestListModel(remote, items, items.Count >= ListLimit, CurrentUser(provider, remote, path));
    }

    public BranchMergeRequestsModel ForBranch(string path, string branch, bool force)
    {
        var key = $"{Path.TrimEndingDirectorySeparator(Path.GetFullPath(path)).ToLowerInvariant()}\n{branch}";
        var now = _now();
        if (!force && _branches.TryGetValue(key, out var cached) && cached.Expires > now)
        {
            return cached.Result;
        }

        var result = ReadBranch(path, branch);
        _branches[key] = (result, now + (result.Error is null ? BranchCacheDuration : FailureCacheDuration));
        return result;
    }

    public MergeRequestFormDataModel FormData(string path, string? source)
    {
        var git = _gitOf(path);
        var remote = Detect(git.Root);
        var provider = ProviderFor(remote);
        var user = Task.Run(() => CurrentUser(provider, remote, git.Root));
        var members = Task.Run(() => provider.Members(remote, git.Root));
        var labels = Task.Run(() => provider.Labels(remote, git.Root));
        var defaultBranch = Task.Run(() => provider.DefaultBranch(remote, git.Root));
        var local = git.LocalBranches();
        var origin = git.OriginBranches();
        var sourceBranch = string.IsNullOrWhiteSpace(source) ? git.CurrentBranch() ?? local.FirstOrDefault() : source.Trim();
        if (sourceBranch is null)
        {
            throw new ForgeException("Aucune branche locale : créez une branche avant d’ouvrir une MR/PR.");
        }

        var failures = new List<string>();
        var memberList = Awaited(members, failures) ?? [];
        var labelList = Awaited(labels, failures) ?? [];
        var forgeDefault = Awaited(defaultBranch, failures);
        if (failures.Count == 3)
        {
            throw new ForgeException(failures[0]);
        }

        var target = DefaultTarget(sourceBranch, origin, _baseBranch(), forgeDefault ?? git.OriginDefaultBranch());
        var sources = local.Union(origin, StringComparer.Ordinal).Order(StringComparer.OrdinalIgnoreCase).ToList();
        return new MergeRequestFormDataModel(
            remote,
            git.Root,
            user.GetAwaiter().GetResult(),
            memberList,
            labelList,
            sources,
            origin,
            target,
            BranchInfo(git, remote, sourceBranch, target),
            failures.Distinct().ToList());
    }

    public MergeRequestBranchInfoModel BranchInfo(string path, string source, string target)
    {
        var git = _gitOf(path);
        return BranchInfo(git, Detect(git.Root), source.Trim(), target.Trim());
    }

    public MergeRequestCreatedModel Create(string path, MergeRequestInputModel? input, bool push)
    {
        var request = MergeRequestInputs.Normalize(input);
        var git = _gitOf(path);
        var remote = Detect(git.Root);
        var source = request.SourceBranch;
        var publication = git.Publication(source);
        if (!publication.Local && !publication.Published)
        {
            throw new ForgeException($"Branche source « {source} » introuvable, ni en local ni sur origin.");
        }

        if (publication.NeedsPush && push)
        {
            git.Push(source);
        }
        else if (!publication.Published)
        {
            throw new ForgeException($"La branche « {source} » n’est pas publiée sur origin : cochez « Pousser la branche avant de créer » ou faites le push vous-même.");
        }

        return ProviderFor(remote).Create(remote, git.Root, request);
    }

    public static string DefaultTarget(string source, IReadOnlyList<string> originBranches, string configuredBase, string? forgeDefault)
    {
        var candidates = new[] { configuredBase.Trim(), forgeDefault ?? string.Empty }.Where(branch => branch.Length > 0 && branch != source);
        return candidates.FirstOrDefault(branch => originBranches.Contains(branch, StringComparer.Ordinal))
            ?? originBranches.FirstOrDefault(branch => branch != source)
            ?? string.Empty;
    }

    private MergeRequestBranchInfoModel BranchInfo(IMergeRequestGit git, ForgeRemoteModel remote, string source, string target)
    {
        var publication = git.Publication(source);
        var commits = target.Length > 0 ? git.Commits(source, target) : [];
        var error = !publication.Local && !publication.Published
            ? $"Branche source « {source} » introuvable, ni en local ni sur origin."
            : target.Length == 0
                ? "Aucune branche cible sur origin : faites un fetch ou publiez une branche."
                : source == target
                    ? "La branche source et la branche cible sont identiques."
                    : null;
        return new MergeRequestBranchInfoModel(
            source,
            target,
            publication,
            commits.Count,
            MergeRequestSuggestion.Title(source, commits),
            MergeRequestSuggestion.Description(commits, git.Template(remote.Kind)),
            ForBranch(git.Root, source, false).Items,
            error);
    }

    private bool IsBaseBranch(string path, string branch)
    {
        if (branch == _baseBranch().Trim())
        {
            return true;
        }

        try
        {
            return branch == _gitOf(path).OriginDefaultBranch();
        }
        catch (ForgeException)
        {
            return true;
        }
    }

    private static T? Awaited<T>(Task<T> task, List<string> failures)
        where T : class?
    {
        try
        {
            return task.GetAwaiter().GetResult();
        }
        catch (ForgeException exception)
        {
            failures.Add(exception.Message);
            return null;
        }
    }

    private BranchMergeRequestsModel ReadBranch(string path, string branch)
    {
        ForgeRemoteModel remote;
        try
        {
            remote = Detect(path);
        }
        catch (ForgeException exception)
        {
            return new BranchMergeRequestsModel(null, [], exception.Message);
        }

        try
        {
            var items = ProviderFor(remote).List(remote, path, new MergeRequestQueryModel(MergeRequestStateFilter.Open, BranchLimit, branch))
                .Where(item => item.SourceBranch == branch)
                .ToList();
            return new BranchMergeRequestsModel(remote, items, null, items.Count == 0 && !IsBaseBranch(path, branch));
        }
        catch (ForgeException exception)
        {
            return new BranchMergeRequestsModel(remote, [], exception.Message);
        }
    }

    private string? CurrentUser(IForgeProvider provider, ForgeRemoteModel remote, string path)
    {
        var key = $"{remote.Kind}\n{remote.Host}";
        if (_users.TryGetValue(key, out var known))
        {
            return known;
        }

        string? user;
        try
        {
            user = provider.CurrentUser(remote, path);
        }
        catch (ForgeException)
        {
            return null;
        }

        if (user is not null)
        {
            _users[key] = user;
        }

        return user;
    }
}

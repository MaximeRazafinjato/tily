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
    private readonly IReadOnlyDictionary<ForgeKind, IForgeProvider> _providers;
    private readonly ConcurrentDictionary<string, string> _users = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, (BranchMergeRequestsModel Result, DateTimeOffset Expires)> _branches = new(StringComparer.Ordinal);

    public ForgeService(IForgeCommandRunner? runner = null, Func<string, string>? originOf = null, Func<IReadOnlySet<string>>? gitLabHosts = null, Func<DateTimeOffset>? now = null)
    {
        var commands = runner ?? new ForgeCliRunner();
        _originOf = originOf ?? ForgeOrigin.Read;
        _gitLabHosts = gitLabHosts ?? GlabHosts.Read;
        _now = now ?? (() => DateTimeOffset.UtcNow);
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
            var items = ProviderFor(remote).List(remote, path, new MergeRequestQueryModel(MergeRequestStateFilter.Open, BranchLimit, branch));
            return new BranchMergeRequestsModel(remote, items.Where(item => item.SourceBranch == branch).ToList(), null);
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

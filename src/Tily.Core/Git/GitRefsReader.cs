namespace Tily.Core.Git;

public static class GitRefsReader
{
    private const char Separator = '\u001f';
    private const string HeadsPrefix = "refs/heads/";
    private const string RemotesPrefix = "refs/remotes/";
    private const string TagsPrefix = "refs/tags/";
    private const string RefFormat = "--format=%(refname)%1f%(objectname)%1f%(*objectname)%1f%(upstream:short)%1f%(upstream:track,nobracket)%1f%(symref)%1f%(HEAD)";
    private const string CurrentMarker = "*";
    private const string StashFormat = "--format=%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%gs";
    private const int StashFields = 6;

    public static GitRefsModel Read(GitRepository repository)
    {
        var remotesRead = Task.Run(repository.Remotes);
        var mergedRead = Task.Run(() => repository.Run("for-each-ref", "--merged=HEAD", "--format=%(refname)", "refs/heads"));
        var refs = Lines(repository.Read(new GitRunOptionsModel(NeutralLocale: true), "for-each-ref", RefFormat, "refs/heads", "refs/remotes", "refs/tags"));
        var remotes = remotesRead.GetAwaiter().GetResult();
        var mergedOutput = mergedRead.GetAwaiter().GetResult();
        var merged = mergedOutput.Succeeded ? Lines(mergedOutput.Output).ToHashSet(StringComparer.Ordinal) : [];
        var branches = new List<GitBranchModel>();
        var remoteBranches = new List<GitRemoteBranchModel>();
        var tags = new List<GitTagModel>();
        foreach (var line in refs)
        {
            var fields = line.Split(Separator);
            if (fields.Length < 7)
            {
                continue;
            }

            var (refName, sha, peeled, upstream, track, symref) = (fields[0], fields[1], fields[2], fields[3], fields[4], fields[5]);
            if (refName.StartsWith(HeadsPrefix, StringComparison.Ordinal))
            {
                var name = refName[HeadsPrefix.Length..];
                var (ahead, behind, gone) = ParseTrack(track);
                branches.Add(new GitBranchModel(name, sha, upstream.Length > 0 ? upstream : null, ahead, behind, gone, fields[6] == CurrentMarker, merged.Contains(refName)));
            }
            else if (refName.StartsWith(RemotesPrefix, StringComparison.Ordinal) && symref.Length == 0)
            {
                var shortName = refName[RemotesPrefix.Length..];
                var remote = RemoteOf(remotes, shortName);
                if (remote is not null)
                {
                    remoteBranches.Add(new GitRemoteBranchModel(shortName, remote, shortName[(remote.Length + 1)..], sha));
                }
            }
            else if (refName.StartsWith(TagsPrefix, StringComparison.Ordinal))
            {
                tags.Add(new GitTagModel(refName[TagsPrefix.Length..], peeled.Length > 0 ? peeled : sha));
            }
        }

        return new GitRefsModel(branches, remoteBranches, tags, remotes);
    }

    public static IReadOnlyList<GitStashModel> ReadStashes(GitRepository repository)
    {
        var output = repository.Run("stash", "list", StashFormat);
        if (!output.Succeeded)
        {
            return [];
        }

        return Lines(output.Output)
            .Select((line, index) => (Index: index, Fields: line.Split(Separator, StashFields)))
            .Where(entry => entry.Fields.Length == StashFields)
            .Select(entry => new GitStashModel(
                entry.Index,
                entry.Fields[0],
                entry.Fields[5],
                GitHistoryReader.Parents(entry.Fields[1]).FirstOrDefault() ?? string.Empty,
                entry.Fields[2],
                entry.Fields[3],
                long.TryParse(entry.Fields[4], out var date) ? date : 0))
            .ToList();
    }

    public static string? RemoteOf(IEnumerable<string> remotes, string remoteBranch) =>
        remotes.Where(remote => remoteBranch.StartsWith($"{remote}/", StringComparison.Ordinal)).OrderByDescending(remote => remote.Length).FirstOrDefault();

    private static (int Ahead, int Behind, bool Gone) ParseTrack(string track)
    {
        if (track == "gone")
        {
            return (0, 0, true);
        }

        var (ahead, behind) = (0, 0);
        foreach (var part in track.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var pieces = part.Split(' ');
            if (pieces.Length == 2 && int.TryParse(pieces[1], out var value))
            {
                ahead = pieces[0] == "ahead" ? value : ahead;
                behind = pieces[0] == "behind" ? value : behind;
            }
        }

        return (ahead, behind, false);
    }

    private static IEnumerable<string> Lines(string output) => output.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}

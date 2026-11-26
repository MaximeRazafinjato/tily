using System.Globalization;
using System.Text.RegularExpressions;

namespace Tily.Core.Git;

public sealed record GitLineHunkModel(int BaseStart, int BaseEnd, int SideStart, int SideEnd);

public static partial class GitMergeAligner
{
    private enum Side
    {
        Ours,
        Theirs
    }

    private sealed record SideHunk(GitLineHunkModel Hunk, Side Side);

    public static IReadOnlyList<GitLineHunkModel> ParseHunks(string diff)
    {
        var hunks = new List<GitLineHunkModel>();
        foreach (Match match in HunkHeader().Matches(diff))
        {
            var (baseStart, baseCount) = Range(match.Groups[1].Value, match.Groups[2].Value);
            var (sideStart, sideCount) = Range(match.Groups[3].Value, match.Groups[4].Value);
            hunks.Add(new GitLineHunkModel(baseStart, baseStart + baseCount, sideStart, sideStart + sideCount));
        }

        return hunks;
    }

    public static IReadOnlyList<GitMergeChunkModel> Merge(IReadOnlyList<string> baseLines, IReadOnlyList<string> ours, IReadOnlyList<string> theirs, IReadOnlyList<GitLineHunkModel> oursHunks, IReadOnlyList<GitLineHunkModel> theirsHunks)
    {
        var hunks = oursHunks.Select(hunk => new SideHunk(hunk, Side.Ours))
            .Concat(theirsHunks.Select(hunk => new SideHunk(hunk, Side.Theirs)))
            .OrderBy(entry => entry.Hunk.BaseStart)
            .ThenBy(entry => entry.Hunk.BaseEnd)
            .ToList();
        var chunks = new List<GitMergeChunkModel>();
        var (oursDelta, theirsDelta, position, index) = (0, 0, 0, 0);
        while (index < hunks.Count)
        {
            var group = new List<SideHunk> { hunks[index] };
            var (start, end) = (hunks[index].Hunk.BaseStart, hunks[index].Hunk.BaseEnd);
            index++;
            while (index < hunks.Count && hunks[index].Hunk.BaseStart <= end)
            {
                group.Add(hunks[index]);
                end = Math.Max(end, hunks[index].Hunk.BaseEnd);
                index++;
            }

            AddCommon(chunks, baseLines, position, start);
            var oursGroup = group.Where(entry => entry.Side == Side.Ours).Select(entry => entry.Hunk).ToList();
            var theirsGroup = group.Where(entry => entry.Side == Side.Theirs).Select(entry => entry.Hunk).ToList();
            var oursLines = Slice(ours, start + oursDelta, end + oursDelta + Growth(oursGroup));
            var theirsLines = Slice(theirs, start + theirsDelta, end + theirsDelta + Growth(theirsGroup));
            AddChange(chunks, oursGroup.Count > 0, theirsGroup.Count > 0, oursLines, theirsLines);
            oursDelta += Growth(oursGroup);
            theirsDelta += Growth(theirsGroup);
            position = end;
        }

        AddCommon(chunks, baseLines, position, baseLines.Count);
        return chunks;
    }

    private static void AddChange(List<GitMergeChunkModel> chunks, bool oursChanged, bool theirsChanged, IReadOnlyList<string> ours, IReadOnlyList<string> theirs)
    {
        if (!theirsChanged)
        {
            Add(chunks, new GitMergeChunkModel(GitMergeChunkKind.Ours, ours, theirs, ours));
            return;
        }

        if (!oursChanged)
        {
            Add(chunks, new GitMergeChunkModel(GitMergeChunkKind.Theirs, ours, theirs, theirs));
            return;
        }

        var prefix = 0;
        while (prefix < ours.Count && prefix < theirs.Count && ours[prefix] == theirs[prefix])
        {
            prefix++;
        }

        var suffix = 0;
        while (suffix < ours.Count - prefix && suffix < theirs.Count - prefix && ours[^(suffix + 1)] == theirs[^(suffix + 1)])
        {
            suffix++;
        }

        AddBoth(chunks, ours.Take(prefix).ToList());
        var oursMiddle = ours.Skip(prefix).Take(ours.Count - prefix - suffix).ToList();
        var theirsMiddle = theirs.Skip(prefix).Take(theirs.Count - prefix - suffix).ToList();
        if (oursMiddle.Count > 0 || theirsMiddle.Count > 0)
        {
            chunks.Add(new GitMergeChunkModel(GitMergeChunkKind.Conflict, oursMiddle, theirsMiddle, null));
        }

        AddBoth(chunks, ours.Skip(ours.Count - suffix).ToList());
    }

    private static void AddBoth(List<GitMergeChunkModel> chunks, IReadOnlyList<string> lines) =>
        Add(chunks, new GitMergeChunkModel(GitMergeChunkKind.Both, lines, lines, lines));

    private static void AddCommon(List<GitMergeChunkModel> chunks, IReadOnlyList<string> baseLines, int start, int end)
    {
        var lines = Slice(baseLines, start, end);
        Add(chunks, new GitMergeChunkModel(GitMergeChunkKind.Common, lines, lines, lines));
    }

    private static void Add(List<GitMergeChunkModel> chunks, GitMergeChunkModel chunk)
    {
        if (chunk.Ours.Count > 0 || chunk.Theirs.Count > 0)
        {
            chunks.Add(chunk);
        }
    }

    private static int Growth(IEnumerable<GitLineHunkModel> hunks) => hunks.Sum(hunk => hunk.SideEnd - hunk.SideStart - (hunk.BaseEnd - hunk.BaseStart));

    private static IReadOnlyList<string> Slice(IReadOnlyList<string> lines, int start, int end)
    {
        var from = Math.Clamp(start, 0, lines.Count);
        var to = Math.Clamp(end, from, lines.Count);
        return lines.Skip(from).Take(to - from).ToList();
    }

    private static (int Start, int Count) Range(string start, string count)
    {
        var first = int.Parse(start, CultureInfo.InvariantCulture);
        var length = count.Length == 0 ? 1 : int.Parse(count, CultureInfo.InvariantCulture);
        return (length == 0 ? first : first - 1, length);
    }

    [GeneratedRegex(@"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@", RegexOptions.Multiline)]
    private static partial Regex HunkHeader();
}

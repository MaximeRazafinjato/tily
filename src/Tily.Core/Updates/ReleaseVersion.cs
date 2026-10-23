namespace Tily.Core.Updates;

public sealed record ReleaseVersion(Version Number, IReadOnlyList<string> Prerelease) : IComparable<ReleaseVersion>
{
    private const char PrereleaseSeparator = '-';
    private const char IdentifierSeparator = '.';

    public static ReleaseVersion? Parse(string text)
    {
        var separator = text.IndexOf(PrereleaseSeparator);
        var number = separator < 0 ? text : text[..separator];
        var prerelease = separator < 0 ? [] : text[(separator + 1)..].Split(IdentifierSeparator);
        if (!Version.TryParse(number, out var parsed) || prerelease.Any(identifier => identifier.Length == 0))
        {
            return null;
        }

        return new ReleaseVersion(parsed, prerelease);
    }

    public static bool IsNewer(string candidate, string current) =>
        Parse(candidate) is { } available && Parse(current) is { } installed && available.CompareTo(installed) > 0;

    public int CompareTo(ReleaseVersion? other)
    {
        if (other is null)
        {
            return 1;
        }

        var byNumber = Number.CompareTo(other.Number);
        if (byNumber != 0)
        {
            return byNumber;
        }

        if (Prerelease.Count == 0 || other.Prerelease.Count == 0)
        {
            return other.Prerelease.Count.CompareTo(Prerelease.Count);
        }

        foreach (var (mine, theirs) in Prerelease.Zip(other.Prerelease))
        {
            var byIdentifier = CompareIdentifiers(mine, theirs);
            if (byIdentifier != 0)
            {
                return byIdentifier;
            }
        }

        return Prerelease.Count.CompareTo(other.Prerelease.Count);
    }

    private static int CompareIdentifiers(string mine, string theirs)
    {
        var mineNumeric = long.TryParse(mine, out var mineNumber);
        var theirsNumeric = long.TryParse(theirs, out var theirsNumber);
        return (mineNumeric, theirsNumeric) switch
        {
            (true, true) => mineNumber.CompareTo(theirsNumber),
            (true, false) => -1,
            (false, true) => 1,
            _ => string.CompareOrdinal(mine, theirs)
        };
    }
}

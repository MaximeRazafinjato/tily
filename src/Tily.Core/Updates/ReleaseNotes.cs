namespace Tily.Core.Updates;

public static class ReleaseNotes
{
    private const string HighlightsHeading = "nouveautés";
    private const int MaxLines = 40;
    private const string TitleSeparator = " — ";
    private const int MaxTitleLength = 60;

    public static IReadOnlyList<ReleaseNoteModel> Highlights(string? body)
    {
        var lines = (body ?? string.Empty).Replace("\r\n", "\n").Split('\n').Select(line => line.Trim()).ToList();
        var start = lines.FindIndex(line => HeadingLevel(line) > 0 && string.Equals(HeadingText(line), HighlightsHeading, StringComparison.OrdinalIgnoreCase));
        var section = start < 0 ? lines : SectionAfter(lines, start);
        return section
            .Where(line => line.Length > 0 && HeadingLevel(line) == 0)
            .Select(WithoutBullet)
            .Select(NoteOf)
            .Take(MaxLines)
            .ToList();
    }

    private static ReleaseNoteModel NoteOf(string line)
    {
        var separator = line.IndexOf(TitleSeparator, StringComparison.Ordinal);
        var title = separator > 0 ? line[..separator].Trim() : string.Empty;
        var text = separator > 0 ? line[(separator + TitleSeparator.Length)..].Trim() : string.Empty;
        return title.Length is > 0 and <= MaxTitleLength && text.Length > 0 ? new ReleaseNoteModel(title, text) : new ReleaseNoteModel(null, line);
    }

    private static IEnumerable<string> SectionAfter(List<string> lines, int start)
    {
        var level = HeadingLevel(lines[start]);
        return lines.Skip(start + 1).TakeWhile(line => HeadingLevel(line) is 0 || HeadingLevel(line) > level);
    }

    private static int HeadingLevel(string line)
    {
        var level = line.TakeWhile(character => character == '#').Count();
        return level > 0 && level < line.Length && line[level] == ' ' ? level : 0;
    }

    private static string HeadingText(string line) => line.TrimStart('#').Trim();

    private static string WithoutBullet(string line) =>
        line.Length > 2 && line[0] is '-' or '*' && line[1] == ' ' ? line[2..].Trim() : line;
}

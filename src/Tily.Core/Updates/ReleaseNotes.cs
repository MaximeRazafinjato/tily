namespace Tily.Core.Updates;

public static class ReleaseNotes
{
    private const string HighlightsHeading = "nouveautés";
    private const int MaxLines = 40;
    private const string TitleSeparator = " — ";
    private const int MaxTitleLength = 60;
    private const int MaxHistoryLines = 200;
    private const string InstallationHeading = "installation";

    public static IReadOnlyList<ReleaseNoteModel> Highlights(string? body)
    {
        var lines = LinesOf(body);
        var start = lines.FindIndex(line => HeadingLevel(line) > 0 && string.Equals(HeadingText(line), HighlightsHeading, StringComparison.OrdinalIgnoreCase));
        var section = start < 0 ? lines : SectionAfter(lines, start);
        return section
            .Where(line => line.Length > 0 && HeadingLevel(line) == 0)
            .Select(WithoutBullet)
            .Select(NoteOf)
            .Take(MaxLines)
            .ToList();
    }

    public static IReadOnlyList<ReleaseNoteSectionModel> Sections(string? body)
    {
        var sections = new List<(string? Title, List<ReleaseNoteModel> Notes)> { (null, []) };
        foreach (var line in LinesOf(body).Where(line => line.Length > 0).Take(MaxHistoryLines))
        {
            if (HeadingLevel(line) > 0)
            {
                sections.Add((HeadingText(line), []));
            }
            else
            {
                sections[^1].Notes.Add(NoteOf(WithoutBullet(line)));
            }
        }

        return sections
            .Where(section => section.Notes.Count > 0 && !string.Equals(section.Title, InstallationHeading, StringComparison.OrdinalIgnoreCase))
            .Select(section => new ReleaseNoteSectionModel(section.Title, section.Notes))
            .ToList();
    }

    private static List<string> LinesOf(string? body) => (body ?? string.Empty).Replace("\r\n", "\n").Split('\n').Select(line => line.Trim()).ToList();

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

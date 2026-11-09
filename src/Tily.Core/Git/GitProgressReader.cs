using System.Text;

namespace Tily.Core.Git;

public static class GitProgressReader
{
    private const int BufferSize = 1024;

    public static async Task<string> ReadAsync(TextReader reader, Action<string> progress)
    {
        var kept = new StringBuilder();
        var line = new StringBuilder();
        string? overwritten = null;
        var buffer = new char[BufferSize];
        int read;
        while ((read = await reader.ReadAsync(buffer, 0, buffer.Length)) > 0)
        {
            foreach (var character in buffer.AsSpan(0, read))
            {
                switch (character)
                {
                    case '\r':
                        overwritten = line.ToString();
                        Report(progress, overwritten);
                        line.Clear();
                        break;
                    case '\n':
                        var text = line.Length == 0 && overwritten is not null ? overwritten : line.ToString();
                        if (line.Length > 0)
                        {
                            Report(progress, text);
                        }

                        kept.Append(text).Append('\n');
                        line.Clear();
                        overwritten = null;
                        break;
                    default:
                        overwritten = null;
                        line.Append(character);
                        break;
                }
            }
        }

        var rest = line.Length == 0 ? overwritten : line.ToString();
        if (line.Length > 0)
        {
            Report(progress, line.ToString());
        }

        return kept.Append(rest).ToString();
    }

    private static void Report(Action<string> progress, string text)
    {
        if (text.Length > 0)
        {
            progress(text);
        }
    }
}

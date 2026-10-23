using Tily.Core.Updates;

namespace Tily.Core.Session;

public static class WindowTitle
{
    public static readonly string ApplicationName = ReleaseChannels.ApplicationName(ReleaseChannels.Current);
    public const int MaxContextLength = 160;
    private const string Separator = " - ";
    private const string Ellipsis = "…";

    public static string For(string? context)
    {
        var cleaned = new string((context ?? string.Empty).Where(character => !char.IsControl(character)).ToArray()).Trim();
        if (cleaned.Length == 0)
        {
            return ApplicationName;
        }

        if (cleaned.Length <= MaxContextLength)
        {
            return cleaned + Separator + ApplicationName;
        }

        var end = char.IsHighSurrogate(cleaned[MaxContextLength - 1]) ? MaxContextLength - 1 : MaxContextLength;
        return cleaned[..end].TrimEnd() + Ellipsis + Separator + ApplicationName;
    }
}

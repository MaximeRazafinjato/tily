using System.Globalization;

namespace Tily.Core.Appearance;

public static class HexColor
{
    private const int ShortLength = 4;
    private const int LongLength = 7;

    public static string? Normalize(string? text)
    {
        var trimmed = text?.Trim().ToLowerInvariant();
        if (trimmed is null || !trimmed.StartsWith('#') || !trimmed[1..].All(Uri.IsHexDigit))
        {
            return null;
        }

        return trimmed.Length switch
        {
            LongLength => trimmed,
            ShortLength => $"#{trimmed[1]}{trimmed[1]}{trimmed[2]}{trimmed[2]}{trimmed[3]}{trimmed[3]}",
            _ => null
        };
    }

    public static (int Red, int Green, int Blue) Channels(string hex) =>
        (Channel(hex, 1), Channel(hex, 3), Channel(hex, 5));

    private static int Channel(string hex, int start) => int.Parse(hex.AsSpan(start, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture);
}

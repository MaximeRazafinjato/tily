namespace Tily.Core.Browser;

public static class BrowserScroll
{
    public const string Up = "up";
    public const string Down = "down";
    public const string Left = "left";
    public const string Right = "right";
    private static readonly string[] Directions = [Up, Down, Left, Right];

    public static string? Direction(string? direction)
    {
        if (string.IsNullOrWhiteSpace(direction))
        {
            return null;
        }

        var value = direction.Trim().ToLowerInvariant();
        return Directions.Contains(value) ? value : throw new InvalidOperationException(Unknown(direction));
    }

    public static string Unknown(string direction) => $"Direction inconnue : « {direction} ». Choisissez up, down, left ou right.";
}

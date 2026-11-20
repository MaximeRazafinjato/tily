using System.Text.Json.Serialization;

namespace Tily.Core.Browser;

public sealed record BrowserTargetModel(string? Ref, string? Selector, string? Text, double? X, double? Y)
{
    [JsonIgnore]
    public bool IsPoint => X is not null;
}

public static class BrowserTargets
{
    public const string Missing = "Indiquez l’élément visé : ref (rendue par tily_browser_snapshot), selector, label, ou x et y.";

    public static BrowserTargetModel? Of(string? reference, string? selector, string? text, double? x, double? y)
    {
        var values = new[] { reference, selector, text }.Select(value => string.IsNullOrWhiteSpace(value) ? null : value.Trim()).ToArray();
        if ((x is null) != (y is null))
        {
            throw new InvalidOperationException("Indiquez x et y ensemble.");
        }

        var ways = values.Count(value => value is not null) + (x is null ? 0 : 1);
        if (ways > 1)
        {
            throw new InvalidOperationException("Indiquez une seule façon de viser l’élément : ref, selector, label, ou x et y.");
        }

        if (x < 0 || y < 0 || x is double.NaN || y is double.NaN)
        {
            throw new InvalidOperationException("Les coordonnées x et y doivent être positives.");
        }

        return ways == 0 ? null : new BrowserTargetModel(values[0], values[1], values[2], x, y);
    }

    public static BrowserTargetModel Required(BrowserTargetModel? target) => target ?? throw new InvalidOperationException(Missing);
}

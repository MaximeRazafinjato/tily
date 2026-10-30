namespace Tily.Core.Appearance;

public sealed record TerminalThemeModel(string Background, string Foreground, string Cursor, string SelectionBackground);

public sealed record WindowColorsModel(string Background, string Foreground, string InactiveForeground, string HoverBackground);

public sealed record AccentThemeModel(string Accent, IReadOnlyDictionary<string, string> Tokens, TerminalThemeModel Terminal, WindowColorsModel Window);

public static class AccentTheme
{
    public const string AccentToken = "green";
    private const double MinAccentLightness = 0.55;
    private const double MaxAccentLightness = 0.8;
    private const double MaxAccentChroma = 0.16;
    private const string SelectionAlpha = "40";

    private static readonly (string Token, double Lightness, double ChromaRatio)[] Shades =
    [
        ("paper", 0.210, 0.115),
        ("panel", 0.2415, 0.13),
        ("line", 0.3025, 0.165),
        ("ink", 0.8845, 0.105),
        ("ink-soft", 0.723, 0.175),
        ("muted", 0.622, 0.205),
        ("green-deep", 0.804, 0.68),
        ("green-soft", 0.286, 0.235),
        ("green-hover", 0.2705, 0.16),
        ("focus", 0.737, 0.88),
        ("terminal", 0.188, 0.105),
        ("terminal-ink", 0.853, 0.125),
        ("scrollbar", 0.3735, 0.2),
        ("scrollbar-hover", 0.468, 0.24)
    ];

    public static AccentThemeModel Build(string accent)
    {
        var normalized = HexColor.Normalize(accent) ?? throw new ArgumentException($"Couleur invalide : {accent}.", nameof(accent));
        var source = OklchColor.FromHex(normalized);
        var lightness = Math.Clamp(source.Lightness, MinAccentLightness, MaxAccentLightness);
        var chroma = Math.Min(source.Chroma, MaxAccentChroma);
        var accentHex = lightness == source.Lightness && chroma == source.Chroma ? normalized : new OklchColor(lightness, chroma, source.Hue).ToHex();
        var tokens = Shades.ToDictionary(shade => shade.Token, shade => new OklchColor(shade.Lightness, chroma * shade.ChromaRatio, source.Hue).ToHex());
        tokens[AccentToken] = accentHex;
        var terminal = new TerminalThemeModel(tokens["terminal"], tokens["terminal-ink"], tokens["focus"], accentHex + SelectionAlpha);
        var window = new WindowColorsModel(tokens["paper"], tokens["ink"], tokens["muted"], tokens["green-hover"]);
        return new AccentThemeModel(accentHex, tokens, terminal, window);
    }
}

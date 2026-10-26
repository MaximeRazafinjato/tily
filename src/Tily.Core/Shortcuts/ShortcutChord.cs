namespace Tily.Core.Shortcuts;

public static class ShortcutChord
{
    public const string Ctrl = "Ctrl";
    public const string Alt = "Alt";
    public const string Shift = "Shift";
    public const string Plus = "Plus";
    private const char Separator = '+';
    private const int MaxFunctionKey = 24;

    private static readonly string[] NamedKeys =
    [
        "Space", "Enter", "Tab", "Escape", "Backspace", "Delete", "Insert", "Home", "End",
        "PageUp", "PageDown", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", Plus
    ];

    private static readonly Dictionary<string, string> DisplayNames = new()
    {
        [Shift] = "Maj",
        ["Space"] = "Espace",
        ["Enter"] = "Entrée",
        ["Escape"] = "Échap",
        ["Backspace"] = "Retour arrière",
        ["Delete"] = "Suppr",
        ["Insert"] = "Inser",
        ["Home"] = "Début",
        ["End"] = "Fin",
        ["PageUp"] = "PgUp",
        ["PageDown"] = "PgDn",
        ["ArrowLeft"] = "←",
        ["ArrowRight"] = "→",
        ["ArrowUp"] = "↑",
        ["ArrowDown"] = "↓",
        [Plus] = "+"
    };

    public static string? Normalize(string? text)
    {
        var parsed = Parse(text);
        return parsed is null ? null : Compose(parsed.Value.Ctrl, parsed.Value.Alt, parsed.Value.Shift && !IsCharacter(parsed.Value.Key), parsed.Value.Key);
    }

    public static string? NormalizeLeaderKey(string? text)
    {
        var parsed = Parse(text);
        return parsed is null || parsed.Value.Ctrl || parsed.Value.Alt ? null : Compose(false, false, parsed.Value.Shift && !IsCharacter(parsed.Value.Key) && !IsLetter(parsed.Value.Key), parsed.Value.Key);
    }

    public static string KeyOf(string chord) => chord[(chord.LastIndexOf(Separator) + 1)..];

    public static bool HasModifier(string chord, string modifier) => chord.Split(Separator).SkipLast(1).Contains(modifier);

    public static bool IsLetter(string key) => key.Length == 1 && char.IsAsciiLetterUpper(key[0]);

    public static bool IsCharacter(string key) => (key.Length == 1 && !IsLetter(key)) || key == Plus;

    public static bool IsPrintable(string key) => key.Length == 1 || key is Plus or "Space";

    public static bool IsFunctionKey(string key) => key.Length > 1 && key[0] == 'F' && int.TryParse(key[1..], out var number) && number is >= 1 and <= MaxFunctionKey;

    public static string Display(string chord) =>
        string.Join("+", chord.Split(Separator).Select(part => DisplayNames.TryGetValue(part, out var name) ? name : part));

    private static (bool Ctrl, bool Alt, bool Shift, string Key)? Parse(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        var parts = text.Split(Separator).Select(part => part.Trim()).ToList();
        var key = NormalizeKey(parts[^1]);
        if (key is null)
        {
            return null;
        }

        bool ctrl = false, alt = false, shift = false;
        foreach (var modifier in parts.SkipLast(1))
        {
            if (modifier.Equals(Ctrl, StringComparison.OrdinalIgnoreCase) || modifier.Equals("Control", StringComparison.OrdinalIgnoreCase))
            {
                ctrl = true;
            }
            else if (modifier.Equals(Alt, StringComparison.OrdinalIgnoreCase))
            {
                alt = true;
            }
            else if (modifier.Equals(Shift, StringComparison.OrdinalIgnoreCase) || modifier.Equals("Maj", StringComparison.OrdinalIgnoreCase))
            {
                shift = true;
            }
            else
            {
                return null;
            }
        }

        return (ctrl, alt, shift, key);
    }

    private static string? NormalizeKey(string key)
    {
        if (key.Length == 1)
        {
            return char.IsWhiteSpace(key[0]) || char.IsControl(key[0]) ? null : key.ToUpperInvariant();
        }

        var named = NamedKeys.FirstOrDefault(name => name.Equals(key, StringComparison.OrdinalIgnoreCase));
        if (named is not null)
        {
            return named;
        }

        var function = key.ToUpperInvariant();
        return IsFunctionKey(function) && function[1] != '0' ? function : null;
    }

    private static string Compose(bool ctrl, bool alt, bool shift, string key)
    {
        var parts = new List<string>();
        if (ctrl)
        {
            parts.Add(Ctrl);
        }

        if (alt)
        {
            parts.Add(Alt);
        }

        if (shift)
        {
            parts.Add(Shift);
        }

        parts.Add(key);
        return string.Join(Separator, parts);
    }
}

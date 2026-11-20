namespace Tily.Core.Browser;

[Flags]
public enum BrowserKeyModifiers
{
    None = 0,
    Alt = 1,
    Ctrl = 2,
    Meta = 4,
    Shift = 8
}

public sealed record BrowserKeyModel(string Key, string Code, int KeyCode, string? Text);

public sealed record BrowserModifierKeyModel(BrowserKeyModifiers Modifier, BrowserKeyModel Key);

public sealed record BrowserKeyChordModel(BrowserKeyModifiers Modifiers, BrowserKeyModel Key, IReadOnlyList<BrowserModifierKeyModel> ModifierKeys);

public static class BrowserKeys
{
    private const int FunctionKeyCount = 12;
    private const int FirstFunctionKeyCode = 112;

    private static readonly BrowserModifierKeyModel[] ModifierOrder =
    [
        new(BrowserKeyModifiers.Ctrl, new BrowserKeyModel("Control", "ControlLeft", 17, null)),
        new(BrowserKeyModifiers.Alt, new BrowserKeyModel("Alt", "AltLeft", 18, null)),
        new(BrowserKeyModifiers.Meta, new BrowserKeyModel("Meta", "MetaLeft", 91, null)),
        new(BrowserKeyModifiers.Shift, new BrowserKeyModel("Shift", "ShiftLeft", 16, null))
    ];

    private static readonly Dictionary<string, BrowserKeyModifiers> Modifiers = new(StringComparer.OrdinalIgnoreCase)
    {
        ["ctrl"] = BrowserKeyModifiers.Ctrl,
        ["control"] = BrowserKeyModifiers.Ctrl,
        ["shift"] = BrowserKeyModifiers.Shift,
        ["maj"] = BrowserKeyModifiers.Shift,
        ["alt"] = BrowserKeyModifiers.Alt,
        ["meta"] = BrowserKeyModifiers.Meta,
        ["win"] = BrowserKeyModifiers.Meta,
        ["cmd"] = BrowserKeyModifiers.Meta
    };

    private static readonly Dictionary<string, BrowserKeyModel> Named = BuildNamed();

    public static BrowserKeyChordModel Parse(string? chord)
    {
        if (string.IsNullOrWhiteSpace(chord))
        {
            throw new InvalidOperationException("Indiquez la touche à presser, par exemple Enter, Escape, Tab ou Ctrl+A.");
        }

        var parts = SplitParts(chord.Trim());
        var modifiers = BrowserKeyModifiers.None;
        foreach (var part in parts[..^1])
        {
            modifiers |= Modifiers.TryGetValue(part, out var modifier)
                ? modifier
                : throw new InvalidOperationException($"Modificateur inconnu : « {part} ». Choisissez Ctrl, Shift, Alt ou Meta.");
        }

        var key = KeyOf(parts[^1], modifiers.HasFlag(BrowserKeyModifiers.Shift));
        var typed = modifiers is BrowserKeyModifiers.None or BrowserKeyModifiers.Shift ? key : key with { Text = null };
        return new BrowserKeyChordModel(modifiers, typed, ModifierKeysOf(modifiers));
    }

    private static string[] SplitParts(string chord)
    {
        if (chord == "+")
        {
            return [chord];
        }

        var parts = chord.EndsWith("++", StringComparison.Ordinal)
            ? [.. chord[..^2].Split('+', StringSplitOptions.TrimEntries), "+"]
            : chord.Split('+', StringSplitOptions.TrimEntries);
        if (parts.Any(string.IsNullOrEmpty))
        {
            throw new InvalidOperationException($"Combinaison illisible : « {chord} ». Écrivez par exemple Ctrl+Shift+K.");
        }

        return parts;
    }

    private static BrowserKeyModel KeyOf(string name, bool shift)
    {
        if (Named.TryGetValue(name, out var named))
        {
            return named;
        }

        if (name.Length != 1 || char.IsControl(name[0]))
        {
            throw new InvalidOperationException($"Touche inconnue : « {name} ». Exemples : Enter, Escape, Tab, Backspace, ArrowDown, PageDown, F5, a, 1.");
        }

        var character = name[0];
        if (char.IsAsciiLetter(character))
        {
            var upper = char.ToUpperInvariant(character);
            var text = (shift ? upper : char.ToLowerInvariant(character)).ToString();
            return new BrowserKeyModel(text, $"Key{upper}", upper, text);
        }

        if (char.IsAsciiDigit(character))
        {
            return new BrowserKeyModel(name, $"Digit{character}", character, name);
        }

        return new BrowserKeyModel(name, string.Empty, 0, name);
    }

    private static List<BrowserModifierKeyModel> ModifierKeysOf(BrowserKeyModifiers modifiers) =>
        ModifierOrder.Where(entry => modifiers.HasFlag(entry.Modifier)).ToList();

    private static Dictionary<string, BrowserKeyModel> BuildNamed()
    {
        var enter = new BrowserKeyModel("Enter", "Enter", 13, "\r");
        var escape = new BrowserKeyModel("Escape", "Escape", 27, null);
        var delete = new BrowserKeyModel("Delete", "Delete", 46, null);
        var space = new BrowserKeyModel(" ", "Space", 32, " ");
        var named = new Dictionary<string, BrowserKeyModel>(StringComparer.OrdinalIgnoreCase)
        {
            ["Enter"] = enter,
            ["Return"] = enter,
            ["Entrée"] = enter,
            ["Escape"] = escape,
            ["Esc"] = escape,
            ["Échap"] = escape,
            ["Tab"] = new("Tab", "Tab", 9, null),
            ["Backspace"] = new("Backspace", "Backspace", 8, null),
            ["Delete"] = delete,
            ["Del"] = delete,
            ["Suppr"] = delete,
            ["Insert"] = new("Insert", "Insert", 45, null),
            ["Space"] = space,
            ["Espace"] = space,
            ["ArrowUp"] = new("ArrowUp", "ArrowUp", 38, null),
            ["ArrowDown"] = new("ArrowDown", "ArrowDown", 40, null),
            ["ArrowLeft"] = new("ArrowLeft", "ArrowLeft", 37, null),
            ["ArrowRight"] = new("ArrowRight", "ArrowRight", 39, null),
            ["Home"] = new("Home", "Home", 36, null),
            ["End"] = new("End", "End", 35, null),
            ["PageUp"] = new("PageUp", "PageUp", 33, null),
            ["PageDown"] = new("PageDown", "PageDown", 34, null)
        };
        foreach (var (alias, arrow) in new[] { ("Up", "ArrowUp"), ("Down", "ArrowDown"), ("Left", "ArrowLeft"), ("Right", "ArrowRight") })
        {
            named[alias] = named[arrow];
        }

        for (var index = 1; index <= FunctionKeyCount; index++)
        {
            named[$"F{index}"] = new BrowserKeyModel($"F{index}", $"F{index}", FirstFunctionKeyCode + index - 1, null);
        }

        return named;
    }
}

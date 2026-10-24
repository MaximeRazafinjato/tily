namespace Tily.Core.Shortcuts;

public static class ShortcutRules
{
    public const int MinLeaderTimeoutSeconds = 1;
    public const int MaxLeaderTimeoutSeconds = 60;
    public const string CloseWindow = "Alt+F4";
    private const string LeaderOwner = "";
    private const string PaletteLetter = "P";
    private const string CancelLeaderKey = "Escape";

    private static readonly Dictionary<string, string> ReservedDirect = new()
    {
        ["Ctrl+Shift+C"] = "copie la sélection du terminal",
        ["Ctrl+Shift+V"] = "colle dans le terminal",
        [CloseWindow] = "ferme Tily",
        ["Ctrl+Enter"] = "insère un retour à la ligne dans un agent",
        ["Shift+Enter"] = "insère un retour à la ligne dans un agent"
    };

    private static readonly string[] ReservedLeader = ["Ctrl+Shift+C", "Ctrl+Shift+V", CloseWindow];

    public static ShortcutSettingsModel Resolve(ShortcutSettingsModel? provided) => Build(provided, false).Settings;

    public static ShortcutResolutionModel Check(ShortcutSettingsModel? provided) => Build(provided, true);

    public static string? DirectProblem(string chord)
    {
        var shown = ShortcutChord.Display(chord);
        if (ReservedDirect.TryGetValue(chord, out var role))
        {
            return $"{shown} est réservé : il {role}.";
        }

        var key = ShortcutChord.KeyOf(chord);
        var ctrl = ShortcutChord.HasModifier(chord, ShortcutChord.Ctrl);
        var alt = ShortcutChord.HasModifier(chord, ShortcutChord.Alt);
        var shift = ShortcutChord.HasModifier(chord, ShortcutChord.Shift);
        if (ctrl && !alt && !shift && ShortcutChord.IsLetter(key) && key != PaletteLetter)
        {
            return $"{shown} est réservé au shell : Ctrl + lettre seule reste au terminal.";
        }

        return !ctrl && !alt && !ShortcutChord.IsFunctionKey(key) && (!shift || ShortcutChord.IsPrintable(key))
            ? $"{shown} n’est pas utilisable : un raccourci direct passe par Ctrl ou Alt, sauf touche de fonction (F1 à F24) ou Maj + touche non imprimable."
            : null;
    }

    public static string? LeaderChordProblem(string chord) =>
        ReservedLeader.Contains(chord) ? $"{ShortcutChord.Display(chord)} est réservé et ne peut pas servir de touche Leader." : null;

    public static string? LeaderKeyProblem(string key)
    {
        if (key == CancelLeaderKey)
        {
            return "Échap après le Leader est réservé : il annule le Leader.";
        }

        return key.Length == 1 && key[0] is >= '1' and <= '9'
            ? $"{key} après le Leader est réservé : il affiche l’onglet {key}."
            : null;
    }

    public static ShortcutSettingsModel Overrides(ShortcutSettingsModel settings)
    {
        var bindings = new Dictionary<string, ShortcutBindingModel>();
        foreach (var command in ShortcutCatalog.Commands)
        {
            var binding = settings.Bindings?.GetValueOrDefault(command.Id);
            var direct = binding?.Direct ?? command.Direct;
            var leader = binding?.Leader ?? command.Leader;
            if (direct != command.Direct || leader != command.Leader)
            {
                bindings[command.Id] = new ShortcutBindingModel(direct != command.Direct ? direct : null, leader != command.Leader ? leader : null);
            }
        }

        return new ShortcutSettingsModel { Leader = settings.Leader, LeaderTimeoutSeconds = settings.LeaderTimeoutSeconds, Bindings = bindings };
    }

    public static IReadOnlyList<string> InterceptedChords(ShortcutSettingsModel settings) =>
        new[] { settings.Leader ?? ShortcutCatalog.DefaultLeader, CloseWindow }
            .Concat((settings.Bindings ?? []).Values.Select(binding => binding.Direct ?? string.Empty))
            .Where(chord => chord.Length > 0)
            .Distinct()
            .ToList();

    private static ShortcutResolutionModel Build(ShortcutSettingsModel? provided, bool strict)
    {
        var errors = new List<string>();
        var leader = ResolveLeader(provided?.Leader, errors);
        var timeout = provided?.LeaderTimeoutSeconds ?? ShortcutCatalog.DefaultLeaderTimeoutSeconds;
        if (timeout is < MinLeaderTimeoutSeconds or > MaxLeaderTimeoutSeconds)
        {
            errors.Add($"Le délai du Leader doit être compris entre {MinLeaderTimeoutSeconds} et {MaxLeaderTimeoutSeconds} secondes.");
            timeout = Math.Clamp(timeout, MinLeaderTimeoutSeconds, MaxLeaderTimeoutSeconds);
        }

        var bindings = provided?.Bindings ?? [];
        var direct = new Claims(leader, ShortcutChord.Normalize, DirectProblem, "raccourci direct", errors);
        var leaderKeys = new Claims(leader, ShortcutChord.NormalizeLeaderKey, LeaderKeyProblem, "touche après le Leader", errors);
        foreach (var command in ShortcutCatalog.Commands)
        {
            var binding = bindings.GetValueOrDefault(command.Id);
            direct.ClaimProvided(command.Id, binding?.Direct);
            leaderKeys.ClaimProvided(command.Id, binding?.Leader);
        }

        foreach (var command in ShortcutCatalog.Commands)
        {
            direct.ClaimDefault(command.Id, command.Direct);
            leaderKeys.ClaimDefault(command.Id, command.Leader);
        }

        var settings = new ShortcutSettingsModel
        {
            Leader = leader,
            LeaderTimeoutSeconds = timeout,
            Bindings = ShortcutCatalog.Commands.ToDictionary(command => command.Id, command => new ShortcutBindingModel(direct.Of(command.Id), leaderKeys.Of(command.Id)))
        };
        return new ShortcutResolutionModel(settings, strict ? errors.FirstOrDefault() : null);
    }

    private static string ResolveLeader(string? text, List<string> errors)
    {
        if (text is null)
        {
            return ShortcutCatalog.DefaultLeader;
        }

        var leader = ShortcutChord.Normalize(text);
        var problem = leader is null ? $"Touche Leader invalide : « {text} »." : LeaderChordProblem(leader);
        if (problem is null)
        {
            return leader!;
        }

        errors.Add(problem);
        return ShortcutCatalog.DefaultLeader;
    }

    private sealed class Claims(string leader, Func<string?, string?> normalize, Func<string, string?> problemOf, string kind, List<string> errors)
    {
        private readonly Dictionary<string, string> _owners = new() { [leader] = LeaderOwner };
        private readonly Dictionary<string, string> _chords = new();

        public void ClaimProvided(string id, string? text)
        {
            if (text is null)
            {
                return;
            }

            if (text.Trim().Length == 0)
            {
                _chords[id] = string.Empty;
                return;
            }

            var chord = normalize(text);
            var problem = chord is null ? $"{Capitalized(kind)} invalide pour « {id} » : « {text} »." : problemOf(chord) ?? ConflictOf(chord, id);
            if (problem is not null)
            {
                errors.Add(problem);
                return;
            }

            _owners[chord!] = id;
            _chords[id] = chord!;
        }

        public void ClaimDefault(string id, string chord)
        {
            if (_chords.ContainsKey(id))
            {
                return;
            }

            var free = chord.Length > 0 && !_owners.ContainsKey(chord);
            _chords[id] = free ? chord : string.Empty;
            if (free)
            {
                _owners[chord] = id;
            }
        }

        public string Of(string id) => _chords.GetValueOrDefault(id, string.Empty);

        private string? ConflictOf(string chord, string id)
        {
            if (!_owners.TryGetValue(chord, out var owner))
            {
                return null;
            }

            return owner == LeaderOwner
                ? $"{ShortcutChord.Display(chord)} est déjà la touche Leader."
                : $"{ShortcutChord.Display(chord)} est attribué à la fois à « {owner} » et à « {id} ».";
        }

        private static string Capitalized(string text) => char.ToUpperInvariant(text[0]) + text[1..];
    }
}

using System.Text.Json.Serialization;

namespace Tily.Core.Appearance;

[JsonConverter(typeof(JsonStringEnumConverter<AmbianceGradientType>))]
public enum AmbianceGradientType
{
    [JsonStringEnumMemberName("linear")] Linear,
    [JsonStringEnumMemberName("radial")] Radial,
    [JsonStringEnumMemberName("plasma")] Plasma,
    [JsonStringEnumMemberName("particles")] Particles,
    [JsonStringEnumMemberName("aurora")] Aurora,
    [JsonStringEnumMemberName("nebula")] Nebula,
    [JsonStringEnumMemberName("sky")] Sky,
    [JsonStringEnumMemberName("caustics")] Caustics
}

[JsonConverter(typeof(JsonStringEnumConverter<AmbianceSource>))]
public enum AmbianceSource
{
    [JsonStringEnumMemberName("gradient")] Gradient,
    [JsonStringEnumMemberName("solid")] Solid,
    [JsonStringEnumMemberName("media")] Media
}

[JsonConverter(typeof(JsonStringEnumConverter<AmbianceFit>))]
public enum AmbianceFit
{
    [JsonStringEnumMemberName("cover")] Cover,
    [JsonStringEnumMemberName("contain")] Contain
}

[JsonConverter(typeof(JsonStringEnumConverter<AmbianceAlertEffect>))]
public enum AmbianceAlertEffect
{
    [JsonStringEnumMemberName("pulse")] Pulse,
    [JsonStringEnumMemberName("wave")] Wave,
    [JsonStringEnumMemberName("confetti")] Confetti,
    [JsonStringEnumMemberName("flash")] Flash,
    [JsonStringEnumMemberName("shake")] Shake,
    [JsonStringEnumMemberName("glitch")] Glitch,
    [JsonStringEnumMemberName("fireworks")] Fireworks,
    [JsonStringEnumMemberName("laser")] Laser,
    [JsonStringEnumMemberName("orbit")] Orbit,
    [JsonStringEnumMemberName("rays")] Rays,
    [JsonStringEnumMemberName("matrix")] Matrix,
    [JsonStringEnumMemberName("warp")] Warp,
    [JsonStringEnumMemberName("banner")] Banner
}

public sealed record AmbianceGradientModel(
    IReadOnlyList<string> Colors,
    AmbianceGradientType Type = AmbianceGradientType.Linear,
    int Angle = 120,
    int Band = 1600,
    double Duration = 12,
    bool Reverse = false)
{
    public const int MinColors = 2;
    public const int MaxColors = 12;
    public const int MaxAngle = 360;
    public const int MinBand = 200;
    public const int MaxBand = 5000;
    public const double MaxDuration = 60;

    public AmbianceGradientModel Normalized(AmbianceGradientModel fallback)
    {
        var colors = (Colors ?? []).Select(HexColor.Normalize).OfType<string>().Take(MaxColors).ToList();
        return this with
        {
            Colors = colors.Count >= MinColors ? colors : fallback.Colors,
            Type = Enum.IsDefined(Type) ? Type : fallback.Type,
            Angle = Math.Clamp(Angle, 0, MaxAngle),
            Band = Math.Clamp(Band, MinBand, MaxBand),
            Duration = double.IsFinite(Duration) ? Math.Clamp(Duration, 0, MaxDuration) : fallback.Duration
        };
    }

    public bool Equals(AmbianceGradientModel? other) =>
        other is not null && Type == other.Type && Angle == other.Angle && Band == other.Band && Duration.Equals(other.Duration) && Reverse == other.Reverse && Colors.SequenceEqual(other.Colors);

    public override int GetHashCode() => HashCode.Combine(Type, Angle, Band, Duration, Reverse, Colors.Count);
}

public sealed record AmbiancePresetModel(string Name, AmbianceGradientModel Gradient);

public sealed record AmbianceBackgroundModel(
    bool Enabled = true,
    AmbianceSource Source = AmbianceSource.Gradient,
    string SolidColor = "#7c4dff",
    int Opacity = 25,
    AmbianceFit Fit = AmbianceFit.Cover,
    string? MediaPath = null);

public sealed record AmbianceTerminalModel(bool Enabled = true, int Veil = 75, bool PresetColors = true, string? FontFamily = null);

public sealed record AmbianceAlertModel(bool Enabled, AmbianceAlertEffect Effect, string Color);

public sealed record AmbiancePerformanceModel(bool ShaderTint = false, int ShaderQuality = 50, int FpsLimit = 30, bool PauseInactive = true)
{
    public const int MinShaderQuality = 25;
    public const int MinFpsLimit = 10;
    public const int MaxFpsLimit = 60;
}

public sealed record AmbianceCompanionsModel(bool Enabled = false, int Size = 26)
{
    public const int MinSize = 14;
    public const int MaxSize = 48;
}

public sealed record AmbianceSettingsModel
{
    public const int MaxPercent = 100;
    public const int MaxPresets = 50;
    public const int MaxPresetNameLength = 40;
    public const int MaxFontFamilyLength = 100;

    public static readonly AmbianceSettingsModel Default = new();

    public bool Enabled { get; init; }
    public AmbianceGradientModel Gradient { get; init; } = AmbiancePresets.Rainbow.Gradient;
    public AmbianceBackgroundModel Background { get; init; } = new();
    public int InterfaceVeil { get; init; }
    public bool AnimatedAccent { get; init; }
    public AmbianceTerminalModel Terminal { get; init; } = new();
    public AmbianceAlertModel Done { get; init; } = new(true, AmbianceAlertEffect.Wave, "#ffc83d");
    public AmbianceAlertModel Waiting { get; init; } = new(true, AmbianceAlertEffect.Pulse, "#ff8a00");
    public AmbiancePerformanceModel Performance { get; init; } = new();
    public AmbianceCompanionsModel Companions { get; init; } = new();
    public IReadOnlyList<AmbiancePresetModel> Presets { get; init; } = [];

    public AmbianceSettingsModel Normalized()
    {
        var background = Background ?? Default.Background;
        var terminal = Terminal ?? Default.Terminal;
        var performance = Performance ?? Default.Performance;
        var companions = Companions ?? Default.Companions;
        return this with
        {
            Gradient = (Gradient ?? Default.Gradient).Normalized(Default.Gradient),
            Background = background with
            {
                Source = Enum.IsDefined(background.Source) ? background.Source : Default.Background.Source,
                SolidColor = HexColor.Normalize(background.SolidColor) ?? Default.Background.SolidColor,
                Opacity = Percent(background.Opacity),
                Fit = Enum.IsDefined(background.Fit) ? background.Fit : Default.Background.Fit,
                MediaPath = AmbianceMedia.IsMediaName(background.MediaPath?.Trim()) ? background.MediaPath!.Trim() : null
            },
            InterfaceVeil = Percent(InterfaceVeil),
            Terminal = terminal with
            {
                Veil = Percent(terminal.Veil),
                FontFamily = FontFamilyOf(terminal.FontFamily)
            },
            Done = AlertOf(Done, Default.Done),
            Waiting = AlertOf(Waiting, Default.Waiting),
            Performance = performance with
            {
                ShaderQuality = Math.Clamp(performance.ShaderQuality, AmbiancePerformanceModel.MinShaderQuality, MaxPercent),
                FpsLimit = Math.Clamp(performance.FpsLimit, AmbiancePerformanceModel.MinFpsLimit, AmbiancePerformanceModel.MaxFpsLimit)
            },
            Companions = companions with { Size = Math.Clamp(companions.Size, AmbianceCompanionsModel.MinSize, AmbianceCompanionsModel.MaxSize) },
            Presets = PresetsOf(Presets)
        };
    }

    public bool Equals(AmbianceSettingsModel? other) =>
        other is not null
        && Enabled == other.Enabled
        && Gradient == other.Gradient
        && Background == other.Background
        && InterfaceVeil == other.InterfaceVeil
        && AnimatedAccent == other.AnimatedAccent
        && Terminal == other.Terminal
        && Done == other.Done
        && Waiting == other.Waiting
        && Performance == other.Performance
        && Companions == other.Companions
        && Presets.SequenceEqual(other.Presets);

    public override int GetHashCode() => HashCode.Combine(Enabled, Gradient, Background, InterfaceVeil, AnimatedAccent, Terminal, Presets.Count);

    private static int Percent(int value) => Math.Clamp(value, 0, MaxPercent);

    private static string? FontFamilyOf(string? fontFamily)
    {
        var trimmed = fontFamily?.Trim();
        return string.IsNullOrEmpty(trimmed) || trimmed.Length > MaxFontFamilyLength || trimmed.Any(character => character is '"' or ';' or '{' or '}' or '<' or '>')
            ? null
            : trimmed;
    }

    private static AmbianceAlertModel AlertOf(AmbianceAlertModel? alert, AmbianceAlertModel fallback) =>
        alert is null
            ? fallback
            : alert with
            {
                Effect = Enum.IsDefined(alert.Effect) ? alert.Effect : fallback.Effect,
                Color = HexColor.Normalize(alert.Color) ?? fallback.Color
            };

    private static List<AmbiancePresetModel> PresetsOf(IReadOnlyList<AmbiancePresetModel>? presets)
    {
        var builtInNames = AmbiancePresets.All.Select(preset => preset.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
        return (presets ?? [])
            .Where(preset => preset?.Gradient is not null && !string.IsNullOrWhiteSpace(preset.Name))
            .Select(preset => new AmbiancePresetModel(preset.Name.Trim(), preset.Gradient.Normalized(Default.Gradient)))
            .Where(preset => preset.Name.Length <= MaxPresetNameLength && !builtInNames.Contains(preset.Name))
            .DistinctBy(preset => preset.Name, StringComparer.OrdinalIgnoreCase)
            .Take(MaxPresets)
            .ToList();
    }
}

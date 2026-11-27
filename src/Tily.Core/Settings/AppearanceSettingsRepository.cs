using System.Text.Json;
using Tily.Core.Appearance;
using Tily.Core.Session;

namespace Tily.Core.Settings;

public sealed record AppearanceSettingsModel(int FontSize = AppearanceSettingsModel.DefaultFontSize)
{
    public const int DefaultFontSize = 14;
    public const int MinFontSize = 8;
    public const int MaxFontSize = 32;

    public static readonly AppearanceSettingsModel Default = new();

    public string? Accent { get; init; }
    public Dictionary<string, string> ProjectColors { get; init; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, CompanionOutfitModel> ProjectOutfits { get; init; } = new(StringComparer.OrdinalIgnoreCase);
    public AmbianceSettingsModel Ambiance { get; init; } = AmbianceSettingsModel.Default;

    public AppearanceSettingsModel Normalized() => this with
    {
        FontSize = Math.Clamp(FontSize, MinFontSize, MaxFontSize),
        Accent = HexColor.Normalize(Accent),
        Ambiance = (Ambiance ?? AmbianceSettingsModel.Default).Normalized(),
        ProjectColors = (ProjectColors ?? [])
            .Where(pair => !string.IsNullOrWhiteSpace(pair.Key) && HexColor.Normalize(pair.Value) is not null)
            .GroupBy(pair => pair.Key.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => HexColor.Normalize(group.Last().Value)!, StringComparer.OrdinalIgnoreCase),
        ProjectOutfits = (ProjectOutfits ?? [])
            .Where(pair => !string.IsNullOrWhiteSpace(pair.Key) && pair.Value is not null)
            .Select(pair => (Project: pair.Key.Trim(), Outfit: pair.Value.Normalized()))
            .Where(pair => !pair.Outfit.IsEmpty)
            .GroupBy(pair => pair.Project, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.Last().Outfit, StringComparer.OrdinalIgnoreCase)
    };

    public AppearanceSettingsModel WithProjectColor(string project, string? color)
    {
        var colors = new Dictionary<string, string>(ProjectColors, StringComparer.OrdinalIgnoreCase);
        if (HexColor.Normalize(color) is { } normalized)
        {
            colors[project] = normalized;
        }
        else
        {
            colors.Remove(project);
        }

        return this with { ProjectColors = colors };
    }

    public AppearanceSettingsModel WithProjectOutfit(string project, CompanionOutfitModel? outfit)
    {
        var outfits = new Dictionary<string, CompanionOutfitModel>(ProjectOutfits, StringComparer.OrdinalIgnoreCase);
        if (outfit?.Normalized() is { IsEmpty: false } normalized)
        {
            outfits[project.Trim()] = normalized;
        }
        else
        {
            outfits.Remove(project.Trim());
        }

        return this with { ProjectOutfits = outfits };
    }

    public bool Equals(AppearanceSettingsModel? other) =>
        other is not null
        && FontSize == other.FontSize
        && Accent == other.Accent
        && Ambiance == other.Ambiance
        && ProjectColors.Count == other.ProjectColors.Count
        && ProjectColors.All(pair => other.ProjectColors.TryGetValue(pair.Key, out var color) && color == pair.Value)
        && ProjectOutfits.Count == other.ProjectOutfits.Count
        && ProjectOutfits.All(pair => other.ProjectOutfits.TryGetValue(pair.Key, out var outfit) && outfit == pair.Value);

    public override int GetHashCode() => HashCode.Combine(FontSize, Accent, ProjectColors.Count);
}

public sealed class AppearanceSettingsRepository
{
    public const string FileName = "appearance.json";

    private readonly string _filePath;

    public AppearanceSettingsRepository(string directory)
    {
        Directory.CreateDirectory(directory);
        _filePath = Path.Combine(directory, FileName);
    }

    public string FilePath => _filePath;

    public void Save(AppearanceSettingsModel settings) => AtomicFile.Write(_filePath, JsonSerializer.Serialize(settings, SessionRepository.JsonOptions));

    public AppearanceSettingsModel Load()
    {
        if (!File.Exists(_filePath))
        {
            File.WriteAllText(_filePath, JsonSerializer.Serialize(AppearanceSettingsModel.Default, SessionRepository.JsonOptions));
            return AppearanceSettingsModel.Default;
        }

        try
        {
            return (JsonSerializer.Deserialize<AppearanceSettingsModel>(File.ReadAllText(_filePath), SessionRepository.JsonOptions) ?? AppearanceSettingsModel.Default).Normalized();
        }
        catch (JsonException)
        {
            return AppearanceSettingsModel.Default;
        }
    }
}

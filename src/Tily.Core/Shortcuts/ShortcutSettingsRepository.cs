using System.Text.Json;
using Tily.Core.Session;

namespace Tily.Core.Shortcuts;

public sealed class ShortcutSettingsRepository
{
    public const string FileName = "shortcuts.json";

    private readonly string _filePath;

    public ShortcutSettingsRepository(string directory)
    {
        Directory.CreateDirectory(directory);
        _filePath = Path.Combine(directory, FileName);
    }

    public string FilePath => _filePath;

    public ShortcutSettingsModel Load()
    {
        if (!File.Exists(_filePath))
        {
            var defaults = ShortcutSettingsModel.Default;
            Save(defaults);
            return defaults;
        }

        try
        {
            return ShortcutRules.Resolve(JsonSerializer.Deserialize<ShortcutSettingsModel>(File.ReadAllText(_filePath), SessionRepository.JsonOptions));
        }
        catch (JsonException)
        {
            return ShortcutSettingsModel.Default;
        }
    }

    public void Save(ShortcutSettingsModel settings) => AtomicFile.Write(_filePath, JsonSerializer.Serialize(ShortcutRules.Overrides(settings), SessionRepository.JsonOptions));
}

using System.Text.Json;
using System.Text.Json.Serialization;

namespace Tily.Core.Session;

public sealed record PersistenceSettingsModel(int TextIntervalSeconds, int LinesPerPane, int MaxTextMebibytes)
{
    public const int MinTextIntervalSeconds = 5;
    public const int MaxTextIntervalSeconds = 600;
    public const int MinLinesPerPane = 500;
    public const int MaxLinesPerPane = 100_000;
    public const int MinTextMebibytes = 16;
    public const int MaxTextMebibytesLimit = 2048;

    public static readonly PersistenceSettingsModel Default = new(30, 3_000, 256);

    [JsonIgnore]
    public long MaxTextBytes => (long)MaxTextMebibytes * 1024 * 1024;

    public PersistenceSettingsModel Clamped() => new(
        Math.Clamp(TextIntervalSeconds, MinTextIntervalSeconds, MaxTextIntervalSeconds),
        Math.Clamp(LinesPerPane, MinLinesPerPane, MaxLinesPerPane),
        Math.Clamp(MaxTextMebibytes, MinTextMebibytes, MaxTextMebibytesLimit));

    public IReadOnlyList<string> OutOfRangeWarnings() =>
        new[]
        {
            OutOfRange("Sauvegarde du texte (secondes)", TextIntervalSeconds, MinTextIntervalSeconds, MaxTextIntervalSeconds),
            OutOfRange("Lignes conservées par pane", LinesPerPane, MinLinesPerPane, MaxLinesPerPane),
            OutOfRange("Historique global maximal (Mio)", MaxTextMebibytes, MinTextMebibytes, MaxTextMebibytesLimit)
        }.OfType<string>().ToList();

    private static string? OutOfRange(string label, int value, int min, int max) =>
        value < min || value > max ? $"{label} : {value} ramené à {Math.Clamp(value, min, max)} (entre {min} et {max})." : null;
}

public sealed class PersistenceSettingsRepository
{
    public const string FileName = "persistence.json";

    private readonly string _filePath;

    public PersistenceSettingsRepository(string directory)
    {
        Directory.CreateDirectory(directory);
        _filePath = Path.Combine(directory, FileName);
    }

    public string FilePath => _filePath;

    public void Save(PersistenceSettingsModel settings) => AtomicFile.Write(_filePath, JsonSerializer.Serialize(settings.Clamped(), SessionRepository.JsonOptions));

    public PersistenceSettingsModel Load()
    {
        if (!File.Exists(_filePath))
        {
            File.WriteAllText(_filePath, JsonSerializer.Serialize(PersistenceSettingsModel.Default, SessionRepository.JsonOptions));
            return PersistenceSettingsModel.Default;
        }

        try
        {
            var settings = JsonSerializer.Deserialize<PersistenceSettingsModel>(File.ReadAllText(_filePath), SessionRepository.JsonOptions);
            return settings?.Clamped() ?? PersistenceSettingsModel.Default;
        }
        catch (JsonException)
        {
            return PersistenceSettingsModel.Default;
        }
    }
}

using System.Text.Json;
using Tily.Core.Session;

namespace Tily.Core.Settings;

public sealed record FeatureFlagsModel(bool CompanionCosmetics = false)
{
    public static readonly FeatureFlagsModel Default = new();
}

public sealed class FeatureFlagsRepository
{
    public const string FileName = "feature-flags.json";

    private readonly string _filePath;

    public FeatureFlagsRepository(string directory)
    {
        Directory.CreateDirectory(directory);
        _filePath = Path.Combine(directory, FileName);
    }

    public string FilePath => _filePath;

    public FeatureFlagsModel Load()
    {
        if (!File.Exists(_filePath))
        {
            Save(FeatureFlagsModel.Default);
            return FeatureFlagsModel.Default;
        }

        try
        {
            return JsonSerializer.Deserialize<FeatureFlagsModel>(File.ReadAllText(_filePath), SessionRepository.JsonOptions) ?? FeatureFlagsModel.Default;
        }
        catch (JsonException)
        {
            return FeatureFlagsModel.Default;
        }
    }

    public void Save(FeatureFlagsModel flags) => AtomicFile.Write(_filePath, JsonSerializer.Serialize(flags, SessionRepository.JsonOptions));
}

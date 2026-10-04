using System.Text.Json;
using System.Text.Json.Serialization;

namespace Tily.Core.Session;

public sealed record WindowPlacementModel(int Left, int Top, int Right, int Bottom, bool Maximized)
{
    public const int MinSize = 200;

    [JsonIgnore]
    public bool IsUsable => Right - Left >= MinSize && Bottom - Top >= MinSize;
}

public sealed class WindowPlacementRepository
{
    public const string FileName = "window.json";

    private readonly string _filePath;

    public WindowPlacementRepository(string sessionDirectory)
    {
        _filePath = Path.Combine(sessionDirectory, FileName);
    }

    public WindowPlacementModel? Load()
    {
        try
        {
            var placement = File.Exists(_filePath) ? JsonSerializer.Deserialize<WindowPlacementModel>(File.ReadAllText(_filePath), SessionRepository.JsonOptions) : null;
            return placement is { IsUsable: true } ? placement : null;
        }
        catch (Exception exception) when (exception is JsonException or IOException or UnauthorizedAccessException)
        {
            return null;
        }
    }

    public void Save(WindowPlacementModel placement)
    {
        if (placement.IsUsable)
        {
            AtomicFile.Write(_filePath, JsonSerializer.Serialize(placement, SessionRepository.JsonOptions));
        }
    }
}

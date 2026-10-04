using System.Text.Json;
using Tily.Core.Session;

namespace Tily.Core.StatusLog;

public sealed class StatusLogRepository
{
    public const string FileName = "status-log.json";
    public const int MaxEntries = 500;
    public const int MaxTextLength = 2000;

    private static readonly Dictionary<string, StatusLogLevel> Levels = new(StringComparer.OrdinalIgnoreCase)
    {
        ["info"] = StatusLogLevel.Info,
        ["warning"] = StatusLogLevel.Warning,
        ["error"] = StatusLogLevel.Error
    };

    private readonly object _sync = new();
    private readonly List<StatusLogEntryModel> _entries = [];

    public StatusLogRepository(string directory)
    {
        Directory.CreateDirectory(directory);
        FilePath = Path.Combine(directory, FileName);
    }

    public string FilePath { get; }

    public static StatusLogLevel ParseLevel(string? level) =>
        level is not null && Levels.TryGetValue(level, out var parsed) ? parsed : throw new InvalidOperationException($"Niveau de message inconnu : {level}");

    public string? Load()
    {
        if (!File.Exists(FilePath))
        {
            return null;
        }

        try
        {
            var file = JsonSerializer.Deserialize<StatusLogFileModel>(File.ReadAllText(FilePath), SessionRepository.JsonOptions);
            var entries = (file?.Entries ?? [])
                .Where(entry => entry is not null && !string.IsNullOrWhiteSpace(entry.Text))
                .Select(entry => entry with { Text = Normalized(entry.Text)! })
                .TakeLast(MaxEntries);
            lock (_sync)
            {
                _entries.Clear();
                _entries.AddRange(entries);
            }

            return null;
        }
        catch (JsonException)
        {
            var kept = CorruptedFiles.Quarantine(FilePath);
            return $"Le journal de la barre de statut était illisible ; copie conservée dans {kept}. Un journal vide a été ouvert.";
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            return $"Impossible de lire le journal de la barre de statut {FilePath} : {exception.Message}";
        }
    }

    public IReadOnlyList<StatusLogEntryModel> Entries()
    {
        lock (_sync)
        {
            return [.. _entries];
        }
    }

    public StatusLogEntryModel? Append(StatusLogLevel level, string? text, DateTimeOffset at)
    {
        var normalized = Normalized(text);
        if (normalized is null)
        {
            return null;
        }

        var entry = new StatusLogEntryModel(at, level, normalized);
        lock (_sync)
        {
            _entries.Add(entry);
            if (_entries.Count > MaxEntries)
            {
                _entries.RemoveRange(0, _entries.Count - MaxEntries);
            }
        }

        return entry;
    }

    public void Clear()
    {
        lock (_sync)
        {
            _entries.Clear();
        }
    }

    public void Save()
    {
        var file = new StatusLogFileModel { Entries = [.. Entries()] };
        AtomicFile.Write(FilePath, JsonSerializer.Serialize(file, SessionRepository.JsonOptions));
    }

    private static string? Normalized(string? text)
    {
        var trimmed = text?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            return null;
        }

        return trimmed.Length <= MaxTextLength ? trimmed : trimmed[..(MaxTextLength - 1)].TrimEnd() + "…";
    }
}

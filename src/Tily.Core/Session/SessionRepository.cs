using System.Text.Encodings.Web;
using System.Text.Json;

namespace Tily.Core.Session;

public sealed record SessionLoadResultModel(SessionModel? Session, string? Error);

public sealed class SessionRepository
{
    public static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        WriteIndented = true,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

    public const string FileName = "session.json";
    public const string PreviousFileName = "session.previous.json";

    private readonly string _filePath;
    private readonly string _previousPath;

    public SessionRepository(string directory)
    {
        Directory.CreateDirectory(directory);
        _filePath = Path.Combine(directory, FileName);
        _previousPath = Path.Combine(directory, PreviousFileName);
    }

    public string FilePath => _filePath;

    public SessionLoadResultModel Load()
    {
        if (!File.Exists(_filePath))
        {
            return new SessionLoadResultModel(null, null);
        }

        string reason;
        try
        {
            var session = JsonSerializer.Deserialize<SessionModel>(File.ReadAllText(_filePath), JsonOptions);
            var result = SessionValidator.Validate(session);
            if (result.IsValid)
            {
                return new SessionLoadResultModel(session, null);
            }

            reason = result.Error ?? "Format de session incorrect.";
        }
        catch (JsonException)
        {
            reason = "JSON illisible.";
        }

        var kept = CorruptedFiles.Quarantine(_filePath);
        var previous = LoadPrevious();
        return previous is null
            ? new SessionLoadResultModel(null, $"La session enregistrée était inutilisable ({reason}) ; copie conservée dans {kept}. Une session de secours a été ouverte.")
            : new SessionLoadResultModel(previous, $"La session enregistrée était inutilisable ({reason}) ; copie conservée dans {kept}. L’avant-dernier enregistrement de la session a été restauré.");
    }

    private void KeepPrevious()
    {
        try
        {
            if (File.Exists(_filePath))
            {
                File.Copy(_filePath, _previousPath, true);
            }
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            return;
        }
    }

    private SessionModel? LoadPrevious()
    {
        try
        {
            var session = File.Exists(_previousPath) ? JsonSerializer.Deserialize<SessionModel>(File.ReadAllText(_previousPath), JsonOptions) : null;
            return session is not null && SessionValidator.Validate(session).IsValid ? session : null;
        }
        catch (Exception exception) when (exception is JsonException or IOException or UnauthorizedAccessException)
        {
            return null;
        }
    }

    public ValidationResultModel Save(SessionModel session)
    {
        var result = SessionValidator.Validate(session);
        if (!result.IsValid)
        {
            return result;
        }

        KeepPrevious();
        AtomicFile.Write(_filePath, JsonSerializer.Serialize(session, JsonOptions));
        return result;
    }
}

using System.Text.Json;
using Tily.Core.StatusLog;

namespace Tily.Core.Session;

public sealed class SessionStore
{
    public const string DirectoryName = "sessions";
    public const string LockFileName = "instance.lock";
    private const int IdLength = 32;
    private static readonly TimeSpan GateTimeout = TimeSpan.FromSeconds(15);
    private static readonly string[] LegacyCompanions = [SessionRepository.PreviousFileName, PaneTextRepository.LegacyFileName, StatusLogRepository.FileName];

    private readonly string _dataDirectory;

    public SessionStore(string dataDirectory)
    {
        _dataDirectory = dataDirectory;
        Root = Path.Combine(dataDirectory, DirectoryName);
    }

    public string Root { get; }

    public string DirectoryOf(string id) => Path.Combine(Root, id);

    public static bool IsValidId(string? id) => id is { Length: IdLength } && id.All(char.IsAsciiHexDigitLower);

    public IDisposable EnterGate()
    {
        var mutex = new Mutex(false, $@"Local\tily-sessions-{DataDirectoryFingerprint.Of(_dataDirectory)}");
        bool acquired;
        try
        {
            acquired = mutex.WaitOne(GateTimeout);
        }
        catch (AbandonedMutexException)
        {
            acquired = true;
        }

        return new Gate(mutex, acquired);
    }

    public IReadOnlyList<string> Ids() =>
        Directory.Exists(Root)
            ? new DirectoryInfo(Root).EnumerateDirectories().Where(directory => IsValidId(directory.Name)).OrderByDescending(LastSavedUtc).Select(directory => directory.Name).ToList()
            : [];

    public SessionClaim? TryClaim(string id)
    {
        var directory = DirectoryOf(id);
        if (!IsValidId(id) || !Directory.Exists(directory))
        {
            return null;
        }

        try
        {
            return new SessionClaim(id, directory, new FileStream(Path.Combine(directory, LockFileName), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None));
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            return null;
        }
    }

    public bool IsOpen(string id)
    {
        using var claim = TryClaim(id);
        return claim is null;
    }

    public SessionClaim Create()
    {
        var id = SessionFactory.NewId();
        Directory.CreateDirectory(DirectoryOf(id));
        return TryClaim(id) ?? throw new InvalidOperationException($"Impossible de réserver la nouvelle session dans {DirectoryOf(id)}.");
    }

    public bool IsRestorable(string id)
    {
        var file = Path.Combine(DirectoryOf(id), SessionRepository.FileName);
        if (!File.Exists(file))
        {
            return false;
        }

        try
        {
            var session = JsonSerializer.Deserialize<SessionModel>(File.ReadAllText(file), SessionRepository.JsonOptions);
            return session?.Workspaces is not { Count: 0 } || !SessionValidator.Validate(session).IsValid;
        }
        catch (Exception exception) when (exception is JsonException or IOException or UnauthorizedAccessException)
        {
            return true;
        }
    }

    public void Forget(string id)
    {
        try
        {
            Directory.Delete(DirectoryOf(id), true);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
        }
    }

    public void Release(SessionClaim claim)
    {
        using var gate = EnterGate();
        claim.Dispose();
        if (!IsRestorable(claim.Id))
        {
            Forget(claim.Id);
        }
    }

    public void MigrateLegacy()
    {
        var session = Path.Combine(_dataDirectory, SessionRepository.FileName);
        if (!File.Exists(session))
        {
            return;
        }

        var target = DirectoryOf(SessionFactory.NewId());
        Directory.CreateDirectory(target);
        try
        {
            File.Move(session, Path.Combine(target, SessionRepository.FileName));
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            Quietly(() => Directory.Delete(target));
            return;
        }

        foreach (var file in LegacyCompanions.Select(name => Path.Combine(_dataDirectory, name)).Where(File.Exists))
        {
            Quietly(() => File.Move(file, Path.Combine(target, Path.GetFileName(file))));
        }

        var text = Path.Combine(_dataDirectory, PaneTextRepository.DirectoryName);
        if (Directory.Exists(text))
        {
            Quietly(() => Directory.Move(text, Path.Combine(target, PaneTextRepository.DirectoryName)));
        }
    }

    public SessionModel? Latest(string exceptId)
    {
        foreach (var id in Ids().Where(id => id != exceptId))
        {
            try
            {
                var file = Path.Combine(DirectoryOf(id), SessionRepository.FileName);
                var session = File.Exists(file) ? JsonSerializer.Deserialize<SessionModel>(File.ReadAllText(file), SessionRepository.JsonOptions) : null;
                if (session is not null && SessionValidator.Validate(session).IsValid)
                {
                    return session;
                }
            }
            catch (Exception exception) when (exception is JsonException or IOException or UnauthorizedAccessException)
            {
            }
        }

        return null;
    }

    private static DateTime LastSavedUtc(DirectoryInfo directory)
    {
        var file = Path.Combine(directory.FullName, SessionRepository.FileName);
        return File.Exists(file) ? File.GetLastWriteTimeUtc(file) : directory.LastWriteTimeUtc;
    }

    private static void Quietly(Action action)
    {
        try
        {
            action();
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
        }
    }

    private sealed class Gate(Mutex mutex, bool acquired) : IDisposable
    {
        public void Dispose()
        {
            if (acquired)
            {
                mutex.ReleaseMutex();
            }

            mutex.Dispose();
        }
    }
}

using Tily.Core.Session;
using Tily.Core.StatusLog;
using Xunit;

namespace Tily.Core.Tests.Session;

public sealed class SessionStoreTests : IDisposable
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), "tily-tests-" + Guid.NewGuid().ToString("N"));
    private readonly SessionStore _store;

    public SessionStoreTests()
    {
        _store = new SessionStore(_directory);
    }

    [Fact]
    public void MigrateLegacy_WhenSessionFilesAtRoot_ThenMovesThemIntoOneSession()
    {
        new SessionRepository(_directory).Save(SessionFactory.Initial());
        Directory.CreateDirectory(Path.Combine(_directory, PaneTextRepository.DirectoryName));
        File.WriteAllText(Path.Combine(_directory, PaneTextRepository.DirectoryName, "pane1.txt"), "texte");
        File.WriteAllText(Path.Combine(_directory, StatusLogRepository.FileName), "{}");

        _store.MigrateLegacy();

        var session = _store.DirectoryOf(Assert.Single(_store.Ids()));
        Assert.True(File.Exists(Path.Combine(session, SessionRepository.FileName)));
        Assert.True(File.Exists(Path.Combine(session, PaneTextRepository.DirectoryName, "pane1.txt")));
        Assert.True(File.Exists(Path.Combine(session, StatusLogRepository.FileName)));
        Assert.False(File.Exists(Path.Combine(_directory, SessionRepository.FileName)));
        Assert.False(Directory.Exists(Path.Combine(_directory, PaneTextRepository.DirectoryName)));
    }

    [Fact]
    public void MigrateLegacy_WhenNothingAtRoot_ThenCreatesNoSession()
    {
        _store.MigrateLegacy();

        Assert.Empty(_store.Ids());
    }

    [Fact]
    public void TryClaim_WhenAlreadyClaimed_ThenRefuses()
    {
        using var first = _store.Create();

        var second = _store.TryClaim(first.Id);

        Assert.Null(second);
    }

    [Fact]
    public void IsOpen_WhenClaimReleased_ThenFalse()
    {
        var claim = _store.Create();
        claim.Dispose();

        var open = _store.IsOpen(claim.Id);

        Assert.False(open);
    }

    [Fact]
    public void TryClaim_WhenSessionUnknown_ThenRefusesWithoutCreatingIt()
    {
        var id = SessionFactory.NewId();

        var claim = _store.TryClaim(id);

        Assert.Null(claim);
        Assert.False(Directory.Exists(_store.DirectoryOf(id)));
    }

    [Fact]
    public void IsRestorable_WhenSessionHasNoWorkspace_ThenFalse()
    {
        var id = Saved(new SessionModel());

        var restorable = _store.IsRestorable(id);

        Assert.False(restorable);
    }

    [Fact]
    public void IsRestorable_WhenSessionHasWorkspaces_ThenTrue()
    {
        var id = Saved(SessionFactory.Initial());

        var restorable = _store.IsRestorable(id);

        Assert.True(restorable);
    }

    [Fact]
    public void IsRestorable_WhenSessionUnreadable_ThenKeptForRecovery()
    {
        var id = SessionFactory.NewId();
        Directory.CreateDirectory(_store.DirectoryOf(id));
        File.WriteAllText(Path.Combine(_store.DirectoryOf(id), SessionRepository.FileName), "{ oops");

        var restorable = _store.IsRestorable(id);

        Assert.True(restorable);
    }

    [Fact]
    public void Release_WhenSessionHasNoWorkspace_ThenForgetsIt()
    {
        var claim = _store.Create();
        new SessionRepository(claim.Directory).Save(new SessionModel());

        _store.Release(claim);

        Assert.False(Directory.Exists(claim.Directory));
    }

    [Fact]
    public void Release_WhenSessionHasWorkspaces_ThenKeepsItUnlocked()
    {
        var claim = _store.Create();
        new SessionRepository(claim.Directory).Save(SessionFactory.Initial());

        _store.Release(claim);

        Assert.True(_store.IsRestorable(claim.Id));
        Assert.False(_store.IsOpen(claim.Id));
    }

    [Fact]
    public void Ids_WhenSeveralSessions_ThenMostRecentlySavedFirst()
    {
        var older = Saved(SessionFactory.Initial());
        var newer = Saved(SessionFactory.Initial());
        File.SetLastWriteTimeUtc(Path.Combine(_store.DirectoryOf(older), SessionRepository.FileName), DateTime.UtcNow.AddHours(-1));

        var ids = _store.Ids();

        Assert.Equal([newer, older], ids);
    }

    [Fact]
    public void Latest_WhenOtherSessionsExist_ThenReturnsTheMostRecentOtherOne()
    {
        var other = SessionFactory.Initial();
        other.Favorites.Add("palette.terminal");
        Saved(other);
        var own = Saved(SessionFactory.Initial());

        var latest = _store.Latest(own);

        Assert.Equal(["palette.terminal"], latest!.Favorites);
    }

    private string Saved(SessionModel session)
    {
        var id = SessionFactory.NewId();
        new SessionRepository(_store.DirectoryOf(id)).Save(session);
        return id;
    }

    public void Dispose()
    {
        if (Directory.Exists(_directory))
        {
            Directory.Delete(_directory, true);
        }
    }
}

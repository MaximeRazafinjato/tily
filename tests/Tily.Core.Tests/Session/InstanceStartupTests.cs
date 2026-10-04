using Tily.Core.Session;
using Xunit;

namespace Tily.Core.Tests.Session;

public sealed class InstanceStartupTests : IDisposable
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), "tily-tests-" + Guid.NewGuid().ToString("N"));
    private readonly SessionStore _store;
    private int _cleanups;

    public InstanceStartupTests()
    {
        _store = new SessionStore(_directory);
    }

    [Fact]
    public void Resolve_WhenColdStartWithSeveralSessions_ThenClaimsTheMostRecentAndListsTheOthers()
    {
        var older = Saved(SessionFactory.Initial(), DateTime.UtcNow.AddHours(-1));
        var newer = Saved(SessionFactory.Initial(), DateTime.UtcNow);

        using var startup = Resolve();

        Assert.Equal(newer, startup.Model.Claim!.Id);
        Assert.Equal([older], startup.Model.Others);
        Assert.True(startup.Model.ColdStart);
    }

    [Fact]
    public void Resolve_WhenColdStart_ThenClearsTransientFilesOnce()
    {
        using var startup = Resolve();

        Assert.Equal(1, _cleanups);
    }

    [Fact]
    public void Resolve_WhenColdStart_ThenForgetsSessionsWithoutWorkspace()
    {
        var empty = Saved(new SessionModel(), DateTime.UtcNow);
        var kept = Saved(SessionFactory.Initial(), DateTime.UtcNow.AddHours(-1));

        using var startup = Resolve();

        Assert.Equal(kept, startup.Model.Claim!.Id);
        Assert.False(Directory.Exists(_store.DirectoryOf(empty)));
    }

    [Fact]
    public void Resolve_WhenAnotherInstanceIsOpen_ThenOpensANewSessionWithoutCleanup()
    {
        using var running = _store.Create();
        new SessionRepository(running.Directory).Save(SessionFactory.Initial());
        var closed = Saved(SessionFactory.Initial(), DateTime.UtcNow);

        using var startup = Resolve();

        Assert.NotEqual(running.Id, startup.Model.Claim!.Id);
        Assert.NotEqual(closed, startup.Model.Claim.Id);
        Assert.Empty(startup.Model.Others);
        Assert.Equal(0, _cleanups);
    }

    [Fact]
    public void Resolve_WhenSessionRequested_ThenClaimsIt()
    {
        using var running = _store.Create();
        var requested = Saved(SessionFactory.Initial(), DateTime.UtcNow);

        using var startup = Resolve(InstanceStartup.SessionArgument, requested);

        Assert.Equal(requested, startup.Model.Claim!.Id);
    }

    [Fact]
    public void Resolve_WhenRequestedSessionAlreadyOpen_ThenClaimsNothing()
    {
        using var running = _store.Create();

        using var startup = Resolve(InstanceStartup.SessionArgument, running.Id);

        Assert.Null(startup.Model.Claim);
    }

    [Fact]
    public void Resolve_WhenNewWindowRequestedOnColdStart_ThenOpensANewSessionAndKeepsTheOthers()
    {
        var saved = Saved(SessionFactory.Initial(), DateTime.UtcNow);

        using var startup = Resolve(InstanceStartup.NewWindowArgument);

        Assert.NotEqual(saved, startup.Model.Claim!.Id);
        Assert.True(_store.IsRestorable(saved));
    }

    [Fact]
    public void Resolve_WhenSessionStillAtTheRootOfTheDataFolder_ThenRestoresIt()
    {
        var legacy = SessionFactory.Initial();
        new SessionRepository(_directory).Save(legacy);

        using var startup = Resolve();

        var restored = new SessionRepository(startup.Model.Claim!.Directory).Load().Session;
        Assert.Equal(legacy.Active, restored!.Active);
    }

    private ClaimedStartup Resolve(params string[] arguments) =>
        new(InstanceStartup.Resolve(_store, ["Tily.exe", .. arguments], () => _cleanups++));

    private string Saved(SessionModel session, DateTime savedAtUtc)
    {
        var id = SessionFactory.NewId();
        new SessionRepository(_store.DirectoryOf(id)).Save(session);
        File.SetLastWriteTimeUtc(Path.Combine(_store.DirectoryOf(id), SessionRepository.FileName), savedAtUtc);
        return id;
    }

    public void Dispose()
    {
        if (Directory.Exists(_directory))
        {
            Directory.Delete(_directory, true);
        }
    }

    private sealed class ClaimedStartup(InstanceStartupModel model) : IDisposable
    {
        public InstanceStartupModel Model { get; } = model;

        public void Dispose() => Model.Claim?.Dispose();
    }
}

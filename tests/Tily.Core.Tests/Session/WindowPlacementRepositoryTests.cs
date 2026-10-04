using Tily.Core.Session;
using Xunit;

namespace Tily.Core.Tests.Session;

public sealed class WindowPlacementRepositoryTests : IDisposable
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), "tily-tests-" + Guid.NewGuid().ToString("N"));

    public WindowPlacementRepositoryTests()
    {
        Directory.CreateDirectory(_directory);
    }

    [Fact]
    public void Save_ThenLoad_RoundTripsThePlacement()
    {
        var repository = new WindowPlacementRepository(_directory);
        var placement = new WindowPlacementModel(1920, 0, 3200, 1040, true);

        repository.Save(placement);

        Assert.Equal(placement, repository.Load());
    }

    [Fact]
    public void Save_WhenWindowTooSmall_ThenKeepsNothing()
    {
        var repository = new WindowPlacementRepository(_directory);

        repository.Save(new WindowPlacementModel(0, 0, 120, 80, false));

        Assert.Null(repository.Load());
    }

    [Fact]
    public void Load_WhenFileUnreadable_ThenNothing()
    {
        File.WriteAllText(Path.Combine(_directory, WindowPlacementRepository.FileName), "{ oops");

        var placement = new WindowPlacementRepository(_directory).Load();

        Assert.Null(placement);
    }

    public void Dispose()
    {
        if (Directory.Exists(_directory))
        {
            Directory.Delete(_directory, true);
        }
    }
}

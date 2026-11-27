using Tily.Core.Settings;
using Xunit;

namespace Tily.Core.Tests.Settings;

public sealed class FeatureFlagsRepositoryTests : IDisposable
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), "tily-tests-" + Guid.NewGuid().ToString("N"));

    [Fact]
    public void Load_WhenFileMissing_ThenWritesTemplateWithCosmeticsDisabled()
    {
        var repository = new FeatureFlagsRepository(_directory);

        var flags = repository.Load();

        Assert.Equal((false, true), (flags.CompanionCosmetics, File.ReadAllText(repository.FilePath).Contains("\"companionCosmetics\": false")));
    }

    [Fact]
    public void Save_ThenLoad_KeepsCompanionCosmetics()
    {
        var repository = new FeatureFlagsRepository(_directory);

        repository.Save(new FeatureFlagsModel(CompanionCosmetics: true));
        var flags = repository.Load();

        Assert.True(flags.CompanionCosmetics, "Le flag des cosmétiques doit être relu activé.");
    }

    [Fact]
    public void Load_WhenFileUnreadable_ThenDefaultsWithoutRewriting()
    {
        var repository = new FeatureFlagsRepository(_directory);
        File.WriteAllText(repository.FilePath, "{ pas du json");

        var flags = repository.Load();

        Assert.Equal((FeatureFlagsModel.Default, "{ pas du json"), (flags, File.ReadAllText(repository.FilePath)));
    }

    public void Dispose()
    {
        if (Directory.Exists(_directory))
        {
            Directory.Delete(_directory, true);
        }
    }
}

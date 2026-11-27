using Tily.Core.Session;
using Xunit;

namespace Tily.Core.Tests.Session;

public sealed class PersistenceSettingsRepositoryTests : IDisposable
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), "tily-tests-" + Guid.NewGuid().ToString("N"));

    [Fact]
    public void Load_WhenNoFile_ThenReturnsDefaultsAndWritesTemplate()
    {
        var repository = new PersistenceSettingsRepository(_directory);

        var settings = repository.Load();

        Assert.Equal(PersistenceSettingsModel.Default, settings);
        Assert.Contains("textIntervalSeconds", File.ReadAllText(repository.FilePath));
    }

    [Fact]
    public void Load_WhenValuesOutOfRange_ThenClampsThem()
    {
        var repository = new PersistenceSettingsRepository(_directory);
        File.WriteAllText(repository.FilePath, """{ "textIntervalSeconds": 1, "linesPerPane": 999999, "maxTextMebibytes": 1 }""");

        var settings = repository.Load();

        Assert.Equal(new PersistenceSettingsModel(PersistenceSettingsModel.MinTextIntervalSeconds, PersistenceSettingsModel.MaxLinesPerPane, PersistenceSettingsModel.MinTextMebibytes), settings);
    }

    [Fact]
    public void Load_WhenTransientBuildServersAbsent_ThenKeepsThemPersistent()
    {
        var repository = new PersistenceSettingsRepository(_directory);
        File.WriteAllText(repository.FilePath, """{ "textIntervalSeconds": 30, "linesPerPane": 10000, "maxTextMebibytes": 256 }""");

        var settings = repository.Load();

        Assert.False(settings.TransientBuildServers);
    }

    [Fact]
    public void Save_WhenTransientBuildServers_ThenReloadsThem()
    {
        var repository = new PersistenceSettingsRepository(_directory);

        repository.Save(PersistenceSettingsModel.Default with { TransientBuildServers = true });

        Assert.True(repository.Load().TransientBuildServers);
    }

    [Fact]
    public void Load_WhenInvalidJson_ThenReturnsDefaults()
    {
        var repository = new PersistenceSettingsRepository(_directory);
        File.WriteAllText(repository.FilePath, "{ pas du json");

        Assert.Equal(PersistenceSettingsModel.Default, repository.Load());
    }

    public void Dispose()
    {
        if (Directory.Exists(_directory))
        {
            Directory.Delete(_directory, true);
        }
    }
}

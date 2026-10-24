using Tily.Core.Shortcuts;
using Xunit;

namespace Tily.Core.Tests.Shortcuts;

public sealed class ShortcutSettingsRepositoryTests : IDisposable
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), "tily-tests-" + Guid.NewGuid().ToString("N"));

    [Fact]
    public void Load_WhenFileMissing_ThenWritesTemplateWithoutBindings()
    {
        var repository = new ShortcutSettingsRepository(_directory);

        repository.Load();

        Assert.Contains("\"bindings\": {}", File.ReadAllText(repository.FilePath));
    }

    [Fact]
    public void Save_ThenLoad_KeepsChangesAndWritesOnlyDifferences()
    {
        var repository = new ShortcutSettingsRepository(_directory);
        var settings = ShortcutRules.Resolve(new ShortcutSettingsModel
        {
            Leader = "Ctrl+Alt+Space",
            LeaderTimeoutSeconds = 8,
            Bindings = new() { ["splitSideBySide"] = new ShortcutBindingModel("", "S") }
        });

        repository.Save(settings);
        var loaded = repository.Load();

        Assert.Equal(("Ctrl+Alt+Space", 8, new ShortcutBindingModel("", "S"), new ShortcutBindingModel("Ctrl+Shift+T", "T")), (loaded.Leader, loaded.LeaderTimeoutSeconds, loaded.Bindings!["splitSideBySide"], loaded.Bindings["newTab"]));
        Assert.DoesNotContain("newTab", File.ReadAllText(repository.FilePath));
    }

    [Fact]
    public void Load_WhenFileUnreadable_ThenDefaults()
    {
        var repository = new ShortcutSettingsRepository(_directory);
        File.WriteAllText(repository.FilePath, "{ pas du json");

        var settings = repository.Load();

        Assert.Equal(ShortcutCatalog.DefaultLeader, settings.Leader);
    }

    public void Dispose()
    {
        if (Directory.Exists(_directory))
        {
            Directory.Delete(_directory, true);
        }
    }
}

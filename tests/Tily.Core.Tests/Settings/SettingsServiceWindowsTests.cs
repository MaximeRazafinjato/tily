using Tily.Core.Agents;
using Tily.Core.Settings;
using Xunit;

namespace Tily.Core.Tests.Settings;

public sealed class SettingsServiceWindowsTests : IDisposable
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), "tily-tests-" + Guid.NewGuid().ToString("N"));

    [Fact]
    public void Save_WhenTwoWindowsChangeDifferentSections_ThenBothChangesAreKept()
    {
        var first = new SettingsService(_directory);
        var second = new SettingsService(_directory);
        var firstBase = first.Load();
        var secondBase = second.Load();
        var firstEdit = first.Load();
        firstEdit.Editor = "notepad.exe";
        var secondEdit = second.Load();
        secondEdit.Notifications = new NotificationSettingsModel(false, NotificationSettingsModel.NoSound, false);

        first.Save(firstEdit, firstBase);
        second.Save(secondEdit, secondBase);
        var loaded = first.Load();

        Assert.Equal("notepad.exe", loaded.Editor);
        Assert.Equal(NotificationSettingsModel.NoSound, loaded.Notifications.Sound);
    }

    [Fact]
    public void Save_WhenNothingChangedAgainstTheBase_ThenWritesNoFile()
    {
        var service = new SettingsService(_directory);
        var baseline = service.Load();
        var editorFile = Path.Combine(_directory, "editor.json");
        File.SetLastWriteTimeUtc(editorFile, DateTime.UtcNow.AddHours(-1));
        var before = File.GetLastWriteTimeUtc(editorFile);

        service.Save(service.Load(), baseline);

        Assert.Equal(before, File.GetLastWriteTimeUtc(editorFile));
    }

    [Fact]
    public void RememberWorktreeFolder_WhenAnotherWindowRememberedOne_ThenKeepsBoth()
    {
        var first = new SettingsService(_directory);
        var second = new SettingsService(_directory);
        var firstSettings = first.Load();
        var secondSettings = second.Load();

        first.RememberWorktreeFolder(firstSettings, @"D:\Projets\tily", @"F:\arbres");
        second.RememberWorktreeFolder(secondSettings, @"D:\Projets\autre", @"G:\arbres");
        var folders = first.Load().WorktreeFolders.Select(entry => entry.Folder);

        Assert.Equal([@"G:\arbres", @"F:\arbres"], folders);
    }

    [Fact]
    public void SameValues_WhenLoadedAgainAfterTheTemplates_ThenEqual()
    {
        var service = new SettingsService(_directory);
        service.Load();

        var same = SettingsService.SameValues(service.Load(), service.Load());

        Assert.True(same);
    }

    public void Dispose()
    {
        if (Directory.Exists(_directory))
        {
            Directory.Delete(_directory, true);
        }
    }
}

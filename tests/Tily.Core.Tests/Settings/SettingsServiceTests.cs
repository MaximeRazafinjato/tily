using Tily.Core.Agents;
using Tily.Core.Git;
using Tily.Core.Session;
using Tily.Core.Settings;
using Tily.Core.Shortcuts;
using Tily.Core.Updates;
using Tily.Core.Worktrees;
using Xunit;

namespace Tily.Core.Tests.Settings;

public sealed class SettingsServiceTests : IDisposable
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), "tily-tests-" + Guid.NewGuid().ToString("N"));

    [Fact]
    public void Load_WhenNoFiles_ThenReturnsDefaultsAndWritesTemplates()
    {
        var service = new SettingsService(_directory);

        var settings = service.Load();

        Assert.Equal("code.cmd", settings.Editor);
        Assert.Equal(PersistenceSettingsModel.Default, settings.Persistence);
        Assert.Equal(@"C:\Files\Projects", settings.ProjectsRoot);
        Assert.Equal(NotificationSettingsModel.Default, settings.Notifications);
        Assert.Equal(GitSettingsModel.Default, settings.Git);
        Assert.Equal(AppearanceSettingsModel.Default, settings.Appearance);
        Assert.Equal(9, Directory.GetFiles(_directory, "*.json").Length);
    }

    [Fact]
    public void Save_ThenLoad_RoundTripsEveryFile()
    {
        var service = new SettingsService(_directory);
        var settings = new SettingsModel
        {
            Shells = new Dictionary<string, string> { ["cmd"] = @"D:\outils\cmd.exe", ["pwsh"] = "  " },
            Editor = " notepad.exe ",
            Persistence = new PersistenceSettingsModel(60, 5000, 128),
            ProjectsRoot = _directory,
            Notifications = new NotificationSettingsModel(false, "notification.im", true)
        };

        var result = service.Save(settings);
        var loaded = service.Load();

        Assert.True(result.IsValid);
        Assert.Equal(new Dictionary<string, string> { ["cmd"] = @"D:\outils\cmd.exe" }, loaded.Shells);
        Assert.Equal("notepad.exe", loaded.Editor);
        Assert.Equal(new PersistenceSettingsModel(60, 5000, 128), loaded.Persistence);
        Assert.Equal(_directory, loaded.ProjectsRoot);
        Assert.Equal(new NotificationSettingsModel(false, "Notification.IM", true), loaded.Notifications);
    }

    [Fact]
    public void Load_WhenNotificationSoundUnknown_ThenFallsBackToDefaultSound()
    {
        var service = new SettingsService(_directory);
        File.WriteAllText(Path.Combine(_directory, NotificationSettingsRepository.FileName), "{ \"windowsToast\": false, \"sound\": \"Klaxon\", \"taskbarFlash\": false }");

        var settings = service.Load();

        Assert.Equal(new NotificationSettingsModel(false, NotificationSettingsModel.DefaultSound, false), settings.Notifications);
    }

    [Fact]
    public void Load_WhenNotificationSoundIsWavPath_ThenKeepsItAndWarnsIfMissing()
    {
        var service = new SettingsService(_directory);
        File.WriteAllText(Path.Combine(_directory, NotificationSettingsRepository.FileName), "{ \"windowsToast\": true, \"sound\": \"C:\\\\Sons\\\\ding.WAV\", \"taskbarFlash\": true }");

        var settings = service.Load();
        var snapshot = service.Snapshot(settings);

        Assert.Equal(@"C:\Sons\ding.WAV", settings.Notifications.Sound);
        Assert.Contains(snapshot.Warnings, warning => warning.Contains(@"C:\Sons\ding.WAV"));
    }

    [Fact]
    public void Load_WhenDoneSettingsMissing_ThenNotifiesDoneWithDistinctSound()
    {
        var service = new SettingsService(_directory);
        File.WriteAllText(Path.Combine(_directory, NotificationSettingsRepository.FileName), "{ \"windowsToast\": true, \"sound\": \"Notification.Default\", \"taskbarFlash\": true }");

        var settings = service.Load();

        Assert.Equal(new NotificationSettingsModel(true, NotificationSettingsModel.DefaultSound, true, true, NotificationSettingsModel.DefaultDoneSound), settings.Notifications);
    }

    [Fact]
    public void Load_WhenDoneSoundUnknown_ThenFallsBackToDefaultDoneSound()
    {
        var service = new SettingsService(_directory);
        File.WriteAllText(Path.Combine(_directory, NotificationSettingsRepository.FileName), "{ \"windowsToast\": true, \"sound\": \"none\", \"taskbarFlash\": true, \"notifyDone\": false, \"doneSound\": \"Klaxon\" }");

        var settings = service.Load();

        Assert.Equal(new NotificationSettingsModel(true, NotificationSettingsModel.NoSound, true, false, NotificationSettingsModel.DefaultDoneSound), settings.Notifications);
    }

    [Fact]
    public void Save_WhenShellUnknown_ThenRefusesWithoutWriting()
    {
        var service = new SettingsService(_directory);
        var settings = new SettingsModel { Shells = new Dictionary<string, string> { ["zsh"] = @"C:\zsh.exe" } };

        var result = service.Save(settings);

        Assert.False(result.IsValid);
        Assert.Equal("Shell inconnu : zsh", result.Error);
        Assert.Empty(Directory.GetFiles(_directory, "*.json"));
    }

    [Fact]
    public void Save_WhenProjectsRootRelative_ThenRefuses()
    {
        var service = new SettingsService(_directory);

        var result = service.Save(new SettingsModel { ProjectsRoot = "Projets" });

        Assert.False(result.IsValid);
        Assert.Contains("chemin absolu", result.Error);
    }

    [Fact]
    public void Snapshot_WhenPathsMissing_ThenWarnsWithoutFailing()
    {
        var service = new SettingsService(_directory);
        var settings = new SettingsModel
        {
            Shells = new Dictionary<string, string> { ["gitbash"] = @"C:\introuvable\bash.exe" },
            ProjectsRoot = @"C:\introuvable\projets"
        };

        var snapshot = service.Snapshot(settings);

        Assert.False(snapshot.Shells.Single(shell => shell.Id == "gitbash").Available);
        Assert.Contains(snapshot.Warnings, warning => warning.Contains(@"C:\introuvable\bash.exe"));
        Assert.Contains(snapshot.Warnings, warning => warning.Contains(@"C:\introuvable\projets"));
        Assert.Equal(9, snapshot.Files.Count);
    }

    [Fact]
    public void Export_ThenImport_RoundTripsWithoutTouchingSettingsFiles()
    {
        var service = new SettingsService(_directory);
        var settings = new SettingsModel
        {
            Shells = new Dictionary<string, string> { ["cmd"] = @"D:\outils\cmd.exe" },
            Editor = "notepad.exe",
            Persistence = new PersistenceSettingsModel(45, 2000, 64),
            ProjectsRoot = _directory
        };
        var exportPath = Path.Combine(_directory, "export", "prefs.json");
        Directory.CreateDirectory(Path.GetDirectoryName(exportPath)!);

        service.Export(settings, exportPath);
        var result = service.Import(exportPath);

        Assert.Null(result.Error);
        Assert.Equal(settings.Shells, result.Settings!.Shells);
        Assert.Equal("notepad.exe", result.Settings.Editor);
        Assert.Equal(new PersistenceSettingsModel(45, 2000, 64), result.Settings.Persistence);
        Assert.Equal(_directory, result.Settings.ProjectsRoot);
        Assert.Empty(Directory.GetFiles(_directory, "*.json"));
    }

    [Fact]
    public void Import_WhenVersionUnsupported_ThenRefuses()
    {
        var service = new SettingsService(_directory);
        var path = Path.Combine(_directory, "prefs.json");
        File.WriteAllText(path, "{ \"version\": 2, \"shells\": {}, \"editor\": \"code.cmd\", \"persistence\": { \"textIntervalSeconds\": 30, \"linesPerPane\": 1000, \"maxTextMebibytes\": 32 }, \"projectsRoot\": \"C:\\\\Projets\" }");

        var result = service.Import(path);

        Assert.Null(result.Settings);
        Assert.Equal("Version de préférences non prise en charge : 2 (attendue : 1).", result.Error);
    }

    [Fact]
    public void Import_WhenKeyMissing_ThenRefuses()
    {
        var service = new SettingsService(_directory);
        var path = Path.Combine(_directory, "prefs.json");
        File.WriteAllText(path, "{ \"version\": 1, \"shells\": {}, \"editor\": \"code.cmd\", \"projectsRoot\": \"C:\\\\Projets\" }");

        var result = service.Import(path);

        Assert.Equal("Le fichier de préférences est incomplet : clé « persistence » absente.", result.Error);
    }

    [Fact]
    public void Import_WhenNotificationsMissing_ThenUsesDefaults()
    {
        var service = new SettingsService(_directory);
        var path = Path.Combine(_directory, "prefs.json");
        File.WriteAllText(path, "{ \"version\": 1, \"shells\": {}, \"editor\": \"code.cmd\", \"persistence\": { \"textIntervalSeconds\": 30, \"linesPerPane\": 1000, \"maxTextMebibytes\": 32 }, \"projectsRoot\": \"C:\\\\Projets\" }");

        var result = service.Import(path);

        Assert.Null(result.Error);
        Assert.Equal(NotificationSettingsModel.Default, result.Settings!.Notifications);
    }

    [Fact]
    public void Import_WhenPersistenceOutOfRange_ThenClampsValues()
    {
        var service = new SettingsService(_directory);
        var path = Path.Combine(_directory, "prefs.json");
        File.WriteAllText(path, "{ \"version\": 1, \"shells\": {}, \"editor\": \"code.cmd\", \"persistence\": { \"textIntervalSeconds\": 3000, \"linesPerPane\": 100, \"maxTextMebibytes\": 64 }, \"projectsRoot\": \"C:\\\\Projets\" }");

        var result = service.Import(path);

        Assert.Equal(new PersistenceSettingsModel(600, 500, 64), result.Settings!.Persistence);
    }

    [Fact]
    public void Import_WhenPersistenceOutOfRange_ThenWarnsForEachClampedValue()
    {
        var service = new SettingsService(_directory);
        var path = Path.Combine(_directory, "prefs.json");
        File.WriteAllText(path, "{ \"version\": 1, \"shells\": {}, \"editor\": \"code.cmd\", \"persistence\": { \"textIntervalSeconds\": 3000, \"linesPerPane\": 100, \"maxTextMebibytes\": 64 }, \"projectsRoot\": \"C:\\\\Projets\" }");

        var result = service.Import(path);

        Assert.Equal(
            [
                "Sauvegarde du texte (secondes) : 3000 ramené à 600 (entre 5 et 600).",
                "Lignes conservées par pane : 100 ramené à 500 (entre 500 et 100000)."
            ],
            result.Warnings);
    }

    [Fact]
    public void Import_WhenPersistenceWithinBounds_ThenReportsNoWarning()
    {
        var service = new SettingsService(_directory);
        var path = Path.Combine(_directory, "prefs.json");
        File.WriteAllText(path, "{ \"version\": 1, \"shells\": {}, \"editor\": \"code.cmd\", \"persistence\": { \"textIntervalSeconds\": 30, \"linesPerPane\": 1000, \"maxTextMebibytes\": 32 }, \"projectsRoot\": \"C:\\\\Projets\" }");

        var result = service.Import(path);

        Assert.Empty(result.Warnings);
    }

    [Fact]
    public void Import_WhenJsonInvalid_ThenRefuses()
    {
        var service = new SettingsService(_directory);
        var path = Path.Combine(_directory, "prefs.json");
        File.WriteAllText(path, "{ version: ");

        var result = service.Import(path);

        Assert.Null(result.Settings);
        Assert.StartsWith("Le fichier de préférences est illisible", result.Error);
    }

    [Fact]
    public void Import_WhenWorktreesMissing_ThenUsesDefaults()
    {
        var service = new SettingsService(_directory);
        var path = Path.Combine(_directory, "prefs.json");
        File.WriteAllText(path, "{ \"version\": 1, \"shells\": {}, \"editor\": \"code.cmd\", \"persistence\": { \"textIntervalSeconds\": 30, \"linesPerPane\": 1000, \"maxTextMebibytes\": 32 }, \"projectsRoot\": \"C:\\\\Projets\" }");

        var result = service.Import(path);

        Assert.Equal(WorktreeSettingsModel.Default, result.Settings!.Worktrees);
    }

    [Fact]
    public void Save_ThenLoad_KeepsWorktreeSettingsInProjectsFile()
    {
        var service = new SettingsService(_directory);
        var settings = service.Load();
        settings.Worktrees = new WorktreeSettingsModel(@" E:\wt ", " main ");

        service.Save(settings);

        Assert.Equal(new WorktreeSettingsModel(@"E:\wt", "main"), service.Load().Worktrees);
    }

    [Fact]
    public void RememberWorktreeFolder_ThenLoadKeepsItWithoutTouchingOtherSettings()
    {
        var service = new SettingsService(_directory);
        var settings = service.Load();
        settings.Worktrees = new WorktreeSettingsModel(@"E:\wt", "main");
        service.Save(settings);

        service.RememberWorktreeFolder(settings, @"D:\Projets\tily", @"F:\arbres");

        var loaded = service.Load();
        Assert.Equal((@"E:\wt", "main"), (loaded.Worktrees.Folder, loaded.Worktrees.DefaultBase));
        Assert.Equal(new WorktreeProjectFolderModel(@"D:\Projets\tily", @"F:\arbres"), Assert.Single(loaded.WorktreeFolders));
        Assert.Equal(@"F:\arbres", settings.WorktreeFolderOf(@"d:\projets\TILY\"));
    }

    [Fact]
    public void RememberWorktreeFolder_WhenFolderIsDefault_ThenForgetsProjectFolder()
    {
        var service = new SettingsService(_directory);
        var settings = service.Load();
        settings.ProjectsRoot = @"D:\Projets";
        service.RememberWorktreeFolder(settings, @"D:\Projets\tily", @"F:\arbres");

        service.RememberWorktreeFolder(settings, @"D:\Projets\tily", @"D:\Projets\worktrees\");

        Assert.Empty(service.Load().WorktreeFolders);
    }

    [Fact]
    public void Save_WhenProjectFolderRemoved_ThenForgetsItButKeepsRepository()
    {
        var service = new SettingsService(_directory);
        var projects = new WorktreeProjectsRepository(_directory);
        projects.SaveRepository(@"D:\Projets\tily", @"D:\Projets\tily\app");
        var settings = service.Load();
        service.RememberWorktreeFolder(settings, @"D:\Projets\tily", @"F:\arbres");

        settings.WorktreeFolders = [];
        service.Save(settings);

        Assert.Empty(service.Load().WorktreeFolders);
        Assert.Equal(@"D:\Projets\tily\app", projects.RepositoryOf(@"D:\Projets\tily"));
    }

    [Fact]
    public void Save_WhenProjectFolderRelative_ThenRefusesInFrench()
    {
        var service = new SettingsService(_directory);
        var settings = service.Load();
        settings.WorktreeFolders = [new WorktreeProjectFolderModel(@"D:\Projets\tily", "relatif")];

        var result = service.Save(settings);

        Assert.Equal(@"Le dossier des worktrees de D:\Projets\tily doit être un chemin absolu : relatif", result.Error);
    }

    [Fact]
    public void Save_WhenWorktreeFolderRelative_ThenRefuses()
    {
        var service = new SettingsService(_directory);
        var settings = service.Load();
        settings.Worktrees = new WorktreeSettingsModel("relatif", "develop");

        var result = service.Save(settings);

        Assert.Equal("Le dossier des worktrees doit être un chemin absolu : relatif", result.Error);
    }

    [Fact]
    public void Save_ThenLoad_KeepsGitSettingsInGitFile()
    {
        var service = new SettingsService(_directory);
        var settings = service.Load();
        settings.Git = new GitSettingsModel(false);

        service.Save(settings);

        Assert.Equal(new GitSettingsModel(false), service.Load().Git);
    }

    [Fact]
    public void Load_WhenGitFileHasNoAutoFetch_ThenEnablesAutoFetch()
    {
        var service = new SettingsService(_directory);
        File.WriteAllText(Path.Combine(_directory, GitSettingsRepository.FileName), "{}");

        var settings = service.Load();

        Assert.True(settings.Git.AutoFetch, "Le fetch automatique est activé par défaut.");
    }

    [Fact]
    public void Import_WhenGitMissing_ThenUsesDefaults()
    {
        var service = new SettingsService(_directory);
        var path = Path.Combine(_directory, "prefs.json");
        File.WriteAllText(path, "{ \"version\": 1, \"shells\": {}, \"editor\": \"code.cmd\", \"persistence\": { \"textIntervalSeconds\": 30, \"linesPerPane\": 1000, \"maxTextMebibytes\": 32 }, \"projectsRoot\": \"C:\\\\Projets\" }");

        var result = service.Import(path);

        Assert.Equal(GitSettingsModel.Default, result.Settings!.Git);
    }

    [Fact]
    public void Export_ThenImport_KeepsGitSettings()
    {
        var service = new SettingsService(_directory);
        var settings = new SettingsModel { ProjectsRoot = _directory, Git = new GitSettingsModel(false) };
        var exportPath = Path.Combine(_directory, "prefs.json");

        service.Export(settings, exportPath);
        var result = service.Import(exportPath);

        Assert.Equal(new GitSettingsModel(false), result.Settings!.Git);
    }

    [Fact]
    public void Import_WhenUpdatesMissing_ThenKeepsAutomaticCheck()
    {
        var service = new SettingsService(_directory);
        var path = Path.Combine(_directory, "prefs.json");
        File.WriteAllText(path, "{ \"version\": 1, \"shells\": {}, \"editor\": \"code.cmd\", \"persistence\": { \"textIntervalSeconds\": 30, \"linesPerPane\": 1000, \"maxTextMebibytes\": 32 }, \"projectsRoot\": \"C:\\\\Projets\" }");

        var result = service.Import(path);

        Assert.Equal(UpdateSettingsModel.Default, result.Settings!.Updates);
    }

    [Fact]
    public void Save_ThenLoad_KeepsAutomaticCheckDisabled()
    {
        var service = new SettingsService(_directory);
        var settings = service.Load();
        settings.Updates = new UpdateSettingsModel(false);

        service.Save(settings);

        Assert.False(service.Load().Updates.AutoCheck);
    }

    [Fact]
    public void Load_WhenUpdatesFileEmptyObject_ThenChecksAutomatically()
    {
        var service = new SettingsService(_directory);
        File.WriteAllText(Path.Combine(_directory, UpdateSettingsRepository.FileName), "{}");

        var settings = service.Load();

        Assert.True(settings.Updates.AutoCheck);
    }

    [Fact]
    public void Save_ThenLoad_KeepsFontSizeClampedInAppearanceFile()
    {
        var service = new SettingsService(_directory);
        var settings = service.Load();
        settings.Appearance = new AppearanceSettingsModel(99);

        service.Save(settings);

        Assert.Equal(new AppearanceSettingsModel(AppearanceSettingsModel.MaxFontSize), service.Load().Appearance);
    }

    [Fact]
    public void SaveAppearance_WhenFontSizeTooSmall_ThenWritesOnlyClampedAppearanceFile()
    {
        var service = new SettingsService(_directory);

        var saved = service.SaveAppearance(new AppearanceSettingsModel(3));

        Assert.Equal(new AppearanceSettingsModel(AppearanceSettingsModel.MinFontSize), saved);
        Assert.Equal([AppearanceSettingsRepository.FileName], Directory.GetFiles(_directory).Select(Path.GetFileName));
        Assert.Equal(saved, service.Load().Appearance);
    }

    [Fact]
    public void Load_WhenAppearanceFileEmptyObject_ThenDefaultFontSize()
    {
        var service = new SettingsService(_directory);
        File.WriteAllText(Path.Combine(_directory, AppearanceSettingsRepository.FileName), "{}");

        var settings = service.Load();

        Assert.Equal(AppearanceSettingsModel.DefaultFontSize, settings.Appearance.FontSize);
    }

    [Fact]
    public void Export_ThenImport_KeepsFontSize()
    {
        var service = new SettingsService(_directory);
        var settings = new SettingsModel { ProjectsRoot = _directory, Appearance = new AppearanceSettingsModel(18) };
        var exportPath = Path.Combine(_directory, "prefs.json");

        service.Export(settings, exportPath);
        var result = service.Import(exportPath);

        Assert.Equal(new AppearanceSettingsModel(18), result.Settings!.Appearance);
    }

    [Fact]
    public void Import_WhenAppearanceMissing_ThenDefaultFontSize()
    {
        var service = new SettingsService(_directory);
        var path = Path.Combine(_directory, "prefs.json");
        File.WriteAllText(path, "{ \"version\": 1, \"shells\": {}, \"editor\": \"code.cmd\", \"persistence\": { \"textIntervalSeconds\": 30, \"linesPerPane\": 1000, \"maxTextMebibytes\": 32 }, \"projectsRoot\": \"C:\\\\Projets\" }");

        var result = service.Import(path);

        Assert.Equal(AppearanceSettingsModel.Default, result.Settings!.Appearance);
    }

    [Fact]
    public void Save_WhenShortcutReserved_ThenRefusesWithoutWritingShortcutsFile()
    {
        var service = new SettingsService(_directory);
        var settings = new SettingsModel { ProjectsRoot = _directory, Shortcuts = new ShortcutSettingsModel { Bindings = new() { ["newTab"] = new ShortcutBindingModel(Direct: "Ctrl+Shift+C") } } };

        var result = service.Save(settings);

        Assert.Equal((false, "Ctrl+Maj+C est réservé : il copie la sélection du terminal.", false), (result.IsValid, result.Error, File.Exists(Path.Combine(_directory, ShortcutSettingsRepository.FileName))));
    }

    [Fact]
    public void Export_ThenImport_KeepsShortcuts()
    {
        var service = new SettingsService(_directory);
        var shortcuts = ShortcutRules.Resolve(new ShortcutSettingsModel { LeaderTimeoutSeconds = 12, Bindings = new() { ["openBrowser"] = new ShortcutBindingModel(Direct: "Ctrl+Shift+U") } });
        var settings = new SettingsModel { ProjectsRoot = _directory, Shortcuts = shortcuts };
        var exportPath = Path.Combine(_directory, "prefs.json");

        service.Export(settings, exportPath);
        var result = service.Import(exportPath);

        Assert.Equal((12, "Ctrl+Shift+U"), (result.Settings!.Shortcuts.LeaderTimeoutSeconds, result.Settings.Shortcuts.Bindings!["openBrowser"].Direct));
    }

    [Fact]
    public void Import_WhenShortcutsMissing_ThenDefaultShortcuts()
    {
        var service = new SettingsService(_directory);
        var path = Path.Combine(_directory, "prefs.json");
        File.WriteAllText(path, "{ \"version\": 1, \"shells\": {}, \"editor\": \"code.cmd\", \"persistence\": { \"textIntervalSeconds\": 30, \"linesPerPane\": 1000, \"maxTextMebibytes\": 32 }, \"projectsRoot\": \"C:\\\\Projets\" }");

        var result = service.Import(path);

        Assert.Equal(new ShortcutBindingModel("Ctrl+Shift+T", "T"), result.Settings!.Shortcuts.Bindings!["newTab"]);
    }

    public void Dispose()
    {
        if (Directory.Exists(_directory))
        {
            Directory.Delete(_directory, true);
        }
    }
}

using Tily.Core.Projects;
using Tily.Core.Settings;
using Xunit;

namespace Tily.Core.Tests.Settings;

public sealed class SettingsServiceProjectsRootsTests : IDisposable
{
    private const string PreferencesWithoutAdditionalRoots = "{ \"version\": 1, \"shells\": {}, \"editor\": \"code.cmd\", \"persistence\": { \"textIntervalSeconds\": 30, \"linesPerPane\": 1000, \"maxTextMebibytes\": 32 }, \"projectsRoot\": \"C:\\\\Projets\" }";

    private readonly string _directory = Path.Combine(Path.GetTempPath(), "tily-tests-" + Guid.NewGuid().ToString("N"));

    [Fact]
    public void Load_WhenNoFiles_ThenNoAdditionalRootAndTemplateDeclaresThem()
    {
        var service = new SettingsService(_directory);

        var settings = service.Load();

        Assert.Equal([ProjectCatalog.DefaultRoot], settings.ProjectsRoots());
        Assert.Contains("\"additionalRoots\": []", File.ReadAllText(Path.Combine(_directory, ProjectsSettingsRepository.FileName)));
    }

    [Fact]
    public void Load_WhenProjectsFileWithoutAdditionalRoots_ThenKeepsOnlyProjectsRoot()
    {
        var service = new SettingsService(_directory);
        File.WriteAllText(Path.Combine(_directory, ProjectsSettingsRepository.FileName), "{ \"root\": \"D:\\\\Projets\" }");

        var settings = service.Load();

        Assert.Equal([@"D:\Projets"], settings.ProjectsRoots());
    }

    [Fact]
    public void Save_WhenAdditionalRoots_ThenTrimsAndDropsBlanksDuplicatesAndProjectsRoot()
    {
        var service = new SettingsService(_directory);
        var settings = service.Load();
        settings.ProjectsRoot = @"D:\Projets";
        settings.AdditionalProjectsRoots = [@" E:\Clients ", "  ", @"e:\clients\", @"D:\Projets\", @"F:\Perso"];

        var result = service.Save(settings);

        Assert.True(result.IsValid);
        Assert.Equal([@"E:\Clients", @"F:\Perso"], service.Load().AdditionalProjectsRoots);
    }

    [Fact]
    public void Save_WhenAdditionalRootRelative_ThenRefusesInFrench()
    {
        var service = new SettingsService(_directory);

        var result = service.Save(new SettingsModel { ProjectsRoot = @"D:\Projets", AdditionalProjectsRoots = ["Clients"] });

        Assert.Equal("Un autre dossier des projets doit être un chemin absolu : Clients", result.Error);
    }

    [Fact]
    public void Snapshot_WhenAdditionalRootMissing_ThenWarns()
    {
        var service = new SettingsService(_directory);
        var settings = new SettingsModel { ProjectsRoot = _directory, AdditionalProjectsRoots = [@"C:\introuvable\clients"] };

        var snapshot = service.Snapshot(settings);

        Assert.Contains(@"Le dossier des projets est introuvable : C:\introuvable\clients", snapshot.Warnings);
    }

    [Fact]
    public void Export_ThenImport_KeepsAdditionalRoots()
    {
        var service = new SettingsService(_directory);
        var settings = new SettingsModel { ProjectsRoot = @"D:\Projets", AdditionalProjectsRoots = [@"E:\Clients"] };
        var exportPath = Path.Combine(_directory, "export", "prefs.json");
        Directory.CreateDirectory(Path.GetDirectoryName(exportPath)!);

        service.Export(settings, exportPath);
        var result = service.Import(exportPath);

        Assert.Equal([@"E:\Clients"], result.Settings!.AdditionalProjectsRoots);
    }

    [Fact]
    public void Import_WhenAdditionalRootsMissing_ThenNone()
    {
        var service = new SettingsService(_directory);
        var path = Path.Combine(_directory, "prefs.json");
        File.WriteAllText(path, PreferencesWithoutAdditionalRoots);

        var result = service.Import(path);

        Assert.Empty(result.Settings!.AdditionalProjectsRoots);
    }

    public void Dispose()
    {
        if (Directory.Exists(_directory))
        {
            Directory.Delete(_directory, true);
        }
    }
}

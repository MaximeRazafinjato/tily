using System.Text.Json;
using Tily.Core.Agents;
using Tily.Core.Context;
using Tily.Core.Git;
using Tily.Core.Projects;
using Tily.Core.Session;
using Tily.Core.Shell;
using Tily.Core.Updates;
using Tily.Core.Worktrees;

namespace Tily.Core.Settings;

public sealed class SettingsService
{
    private readonly ShellPathsRepository _shells;
    private readonly EditorSettingsRepository _editor;
    private readonly PersistenceSettingsRepository _persistence;
    private readonly ProjectsSettingsRepository _projects;
    private readonly NotificationSettingsRepository _notifications;
    private readonly GitSettingsRepository _git;
    private readonly UpdateSettingsRepository _updates;
    private readonly AppearanceSettingsRepository _appearance;
    private readonly WorktreeProjectsRepository _worktreeProjects;

    public SettingsService(string directory)
    {
        _shells = new ShellPathsRepository(directory);
        _editor = new EditorSettingsRepository(directory);
        _persistence = new PersistenceSettingsRepository(directory);
        _projects = new ProjectsSettingsRepository(directory);
        _notifications = new NotificationSettingsRepository(directory);
        _git = new GitSettingsRepository(directory);
        _updates = new UpdateSettingsRepository(directory);
        _appearance = new AppearanceSettingsRepository(directory);
        _worktreeProjects = new WorktreeProjectsRepository(directory);
    }

    public SettingsModel Load()
    {
        var projects = _projects.Load();
        return new SettingsModel
        {
            Shells = _shells.Load().Executables.ToDictionary(pair => pair.Key, pair => pair.Value),
            Editor = _editor.Load().Command,
            Persistence = _persistence.Load(),
            ProjectsRoot = projects.Root,
            Notifications = _notifications.Load(),
            Worktrees = projects.Worktrees ?? WorktreeSettingsModel.Default,
            WorktreeFolders = _worktreeProjects.Folders(),
            Git = _git.Load(),
            Updates = _updates.Load(),
            Appearance = _appearance.Load()
        };
    }

    public ValidationResultModel Validate(SettingsModel settings)
    {
        var knownShells = ShellCatalog.Profiles().Select(profile => profile.Id).ToHashSet();
        var unknown = settings.Shells.Keys.FirstOrDefault(id => !knownShells.Contains(id));
        if (unknown is not null)
        {
            return ValidationResultModel.Fail($"Shell inconnu : {unknown}");
        }

        if (string.IsNullOrWhiteSpace(settings.Editor))
        {
            return ValidationResultModel.Fail("La commande de l’éditeur est vide.");
        }

        if (string.IsNullOrWhiteSpace(settings.ProjectsRoot))
        {
            return ValidationResultModel.Fail("Le dossier des projets est vide.");
        }

        if (!Path.IsPathRooted(settings.ProjectsRoot))
        {
            return ValidationResultModel.Fail($"Le dossier des projets doit être un chemin absolu : {settings.ProjectsRoot}");
        }

        if ((settings.Worktrees ?? WorktreeSettingsModel.Default).Error() is { } worktreeError)
        {
            return ValidationResultModel.Fail(worktreeError);
        }

        var relative = NormalizedFolders(settings.WorktreeFolders ?? []).FirstOrDefault(entry => !Path.IsPathRooted(entry.Project) || !Path.IsPathRooted(entry.Folder));
        return relative is null
            ? ValidationResultModel.Ok()
            : ValidationResultModel.Fail($"Le dossier des worktrees de {relative.Project} doit être un chemin absolu : {relative.Folder}");
    }

    public ValidationResultModel Save(SettingsModel settings, SettingsModel? baseline = null)
    {
        var result = Validate(settings);
        if (!result.IsValid)
        {
            return result;
        }

        Normalize(settings);
        if (baseline is not null)
        {
            Normalize(baseline);
        }

        foreach (var section in Sections().Where(section => baseline is null || !SameValue(section.Value(settings), section.Value(baseline))))
        {
            section.Write(settings);
        }

        return result;
    }

    public static bool SameValues(SettingsModel first, SettingsModel second) => SameValue(first, second);

    private static void Normalize(SettingsModel settings)
    {
        settings.Shells = (settings.Shells ?? []).Where(pair => !string.IsNullOrWhiteSpace(pair.Value)).ToDictionary(pair => pair.Key, pair => pair.Value.Trim());
        settings.Editor = (settings.Editor ?? string.Empty).Trim();
        settings.Persistence = (settings.Persistence ?? PersistenceSettingsModel.Default).Clamped();
        settings.ProjectsRoot = (settings.ProjectsRoot ?? string.Empty).Trim();
        settings.Notifications = (settings.Notifications ?? NotificationSettingsModel.Default).Normalized();
        settings.Worktrees = (settings.Worktrees ?? WorktreeSettingsModel.Default).Normalized();
        settings.WorktreeFolders = NormalizedFolders(settings.WorktreeFolders ?? []);
        settings.Git ??= GitSettingsModel.Default;
        settings.Updates ??= UpdateSettingsModel.Default;
        settings.Appearance = (settings.Appearance ?? AppearanceSettingsModel.Default).Clamped();
    }

    private IEnumerable<SettingsSectionModel> Sections() =>
    [
        new(settings => new SortedDictionary<string, string>(settings.Shells, StringComparer.Ordinal), settings => _shells.Save(settings.Shells)),
        new(settings => settings.Editor, settings => _editor.Save(new EditorSettingsModel(settings.Editor))),
        new(settings => settings.Persistence, settings => _persistence.Save(settings.Persistence)),
        new(settings => new ProjectsSettingsModel(settings.ProjectsRoot, settings.Worktrees), settings => _projects.Save(new ProjectsSettingsModel(settings.ProjectsRoot, settings.Worktrees))),
        new(settings => settings.WorktreeFolders, settings => _worktreeProjects.SaveFolders(settings.WorktreeFolders)),
        new(settings => settings.Notifications, settings => _notifications.Save(settings.Notifications)),
        new(settings => settings.Git, settings => _git.Save(settings.Git)),
        new(settings => settings.Updates, settings => _updates.Save(settings.Updates)),
        new(settings => settings.Appearance, settings => _appearance.Save(settings.Appearance))
    ];

    private static bool SameValue(object first, object second) =>
        JsonSerializer.Serialize(first, SessionRepository.JsonOptions) == JsonSerializer.Serialize(second, SessionRepository.JsonOptions);

    private sealed record SettingsSectionModel(Func<SettingsModel, object> Value, Action<SettingsModel> Write);

    public AppearanceSettingsModel SaveAppearance(AppearanceSettingsModel appearance)
    {
        var clamped = appearance.Clamped();
        _appearance.Save(clamped);
        return clamped;
    }

    public void RememberWorktreeFolder(SettingsModel settings, string project, string folder)
    {
        var others = _worktreeProjects.Folders().Where(entry => !WorktreeTarget.SamePath(entry.Project, project));
        var remembered = WorktreeTarget.SamePath(folder, settings.Worktrees.FolderFor(settings.ProjectsRoot)) ? others : others.Append(new WorktreeProjectFolderModel(project, folder));
        var folders = NormalizedFolders(remembered.ToList());
        _worktreeProjects.SaveFolders(folders);
        settings.WorktreeFolders = folders;
    }

    public void Export(SettingsModel settings, string filePath) =>
        AtomicFile.Write(filePath, JsonSerializer.Serialize(PreferencesDocumentModel.From(settings), SessionRepository.JsonOptions));

    public PreferencesImportResultModel Import(string filePath)
    {
        PreferencesDocumentModel? document;
        try
        {
            document = JsonSerializer.Deserialize<PreferencesDocumentModel>(File.ReadAllText(filePath), SessionRepository.JsonOptions);
        }
        catch (JsonException exception)
        {
            return PreferencesImportResultModel.Failed($"Le fichier de préférences est illisible : {exception.Message}");
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            return PreferencesImportResultModel.Failed($"Impossible de lire {filePath} : {exception.Message}");
        }

        if (document is null)
        {
            return PreferencesImportResultModel.Failed("Le fichier de préférences est vide.");
        }

        if (document.Version != PreferencesDocumentModel.CurrentVersion)
        {
            var version = document.Version?.ToString() ?? "absente";
            return PreferencesImportResultModel.Failed($"Version de préférences non prise en charge : {version} (attendue : {PreferencesDocumentModel.CurrentVersion}).");
        }

        var missing = document.MissingKey();
        if (missing is not null)
        {
            return PreferencesImportResultModel.Failed($"Le fichier de préférences est incomplet : clé « {missing} » absente.");
        }

        var settings = new SettingsModel
        {
            Shells = document.Shells!,
            Editor = document.Editor!,
            Persistence = document.Persistence!.Clamped(),
            ProjectsRoot = document.ProjectsRoot!,
            Notifications = (document.Notifications ?? NotificationSettingsModel.Default).Normalized(),
            Worktrees = (document.Worktrees ?? WorktreeSettingsModel.Default).Normalized(),
            WorktreeFolders = _worktreeProjects.Folders(),
            Git = document.Git ?? GitSettingsModel.Default,
            Updates = document.Updates ?? UpdateSettingsModel.Default,
            Appearance = (document.Appearance ?? AppearanceSettingsModel.Default).Clamped()
        };
        var validation = Validate(settings);
        return validation.IsValid
            ? new PreferencesImportResultModel(settings, null, document.Persistence!.OutOfRangeWarnings())
            : PreferencesImportResultModel.Failed($"Préférences refusées : {validation.Error}");
    }

    public SettingsSnapshotModel Snapshot(SettingsModel settings)
    {
        var paths = ShellPaths(settings);
        var defaults = ShellCatalog.Profiles(ShellPathsModel.Empty).ToDictionary(profile => profile.Id, profile => profile.Executable);
        var shells = ShellCatalog.Profiles(paths)
            .Select(profile => new ShellSettingModel(profile.Id, profile.Name, defaults[profile.Id], paths.ExecutableFor(profile.Id) ?? string.Empty, profile.Available))
            .ToList();
        var warnings = shells.Where(shell => !shell.Available).Select(shell => $"Le shell « {shell.Name} » est introuvable : {(shell.Configured.Length > 0 ? shell.Configured : shell.DefaultExecutable)}").ToList();
        if (!string.IsNullOrWhiteSpace(settings.Editor) && !CommandLocator.Exists(settings.Editor))
        {
            warnings.Add(Path.IsPathRooted(settings.Editor.Trim().Trim('"'))
                ? $"La commande de l’éditeur est introuvable : {settings.Editor}"
                : $"La commande de l’éditeur est introuvable : « {settings.Editor} » n’est ni dans le PATH ni parmi les applications enregistrées");
        }

        if (settings.Notifications.UsesFile && !File.Exists(settings.Notifications.Sound))
        {
            warnings.Add($"Le fichier son est introuvable : {settings.Notifications.Sound}");
        }

        if (NotificationSettingsModel.IsWavPath(settings.Notifications.DoneSound) && !File.Exists(settings.Notifications.DoneSound))
        {
            warnings.Add($"Le fichier son de fin est introuvable : {settings.Notifications.DoneSound}");
        }

        if (!Directory.Exists(settings.ProjectsRoot))
        {
            warnings.Add($"Le dossier des projets est introuvable : {settings.ProjectsRoot}");
        }

        var worktreeFolder = settings.Worktrees.FolderFor(settings.ProjectsRoot);
        if (!string.IsNullOrWhiteSpace(settings.Worktrees.Folder) && !Directory.Exists(worktreeFolder))
        {
            warnings.Add($"Le dossier des worktrees est introuvable : {worktreeFolder}");
        }

        var files = new Dictionary<string, string>
        {
            ["shells"] = _shells.FilePath,
            ["editor"] = _editor.FilePath,
            ["persistence"] = _persistence.FilePath,
            ["projects"] = _projects.FilePath,
            ["notifications"] = _notifications.FilePath,
            ["git"] = _git.FilePath,
            ["updates"] = _updates.FilePath,
            ["appearance"] = _appearance.FilePath
        };
        return new SettingsSnapshotModel(settings, shells, files, warnings);
    }

    private static List<WorktreeProjectFolderModel> NormalizedFolders(IReadOnlyList<WorktreeProjectFolderModel> folders) =>
        folders
            .Where(entry => !string.IsNullOrWhiteSpace(entry?.Project) && !string.IsNullOrWhiteSpace(entry.Folder))
            .Select(entry => new WorktreeProjectFolderModel(WorktreeLister.NormalizePath(entry.Project.Trim()), entry.Folder.Trim()))
            .DistinctBy(entry => entry.Project, StringComparer.OrdinalIgnoreCase)
            .ToList();

    public static ShellPathsModel ShellPaths(SettingsModel settings) =>
        new(settings.Shells.Where(pair => !string.IsNullOrWhiteSpace(pair.Value)).ToDictionary(pair => pair.Key, pair => pair.Value, StringComparer.OrdinalIgnoreCase));
}

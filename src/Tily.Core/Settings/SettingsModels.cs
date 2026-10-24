using Tily.Core.Agents;
using Tily.Core.Context;
using Tily.Core.Git;
using Tily.Core.Projects;
using Tily.Core.Session;
using Tily.Core.Shortcuts;
using Tily.Core.Updates;
using Tily.Core.Worktrees;

namespace Tily.Core.Settings;

public sealed class SettingsModel
{
    public Dictionary<string, string> Shells { get; set; } = new();
    public string Editor { get; set; } = EditorSettingsModel.DefaultCommand;
    public PersistenceSettingsModel Persistence { get; set; } = PersistenceSettingsModel.Default;
    public string ProjectsRoot { get; set; } = ProjectCatalog.DefaultRoot;
    public NotificationSettingsModel Notifications { get; set; } = NotificationSettingsModel.Default;
    public WorktreeSettingsModel Worktrees { get; set; } = WorktreeSettingsModel.Default;
    public List<WorktreeProjectFolderModel> WorktreeFolders { get; set; } = [];
    public GitSettingsModel Git { get; set; } = GitSettingsModel.Default;
    public UpdateSettingsModel Updates { get; set; } = UpdateSettingsModel.Default;
    public AppearanceSettingsModel Appearance { get; set; } = AppearanceSettingsModel.Default;
    public ShortcutSettingsModel Shortcuts { get; set; } = ShortcutSettingsModel.Default;

    public string? WorktreeFolderOf(string? project) =>
        project is null ? null : WorktreeFolders.FirstOrDefault(entry => WorktreeTarget.SamePath(entry.Project, project))?.Folder;
}

public sealed record ShellSettingModel(string Id, string Name, string DefaultExecutable, string Configured, bool Available);

public sealed record SettingsSnapshotModel(SettingsModel Settings, IReadOnlyList<ShellSettingModel> Shells, IReadOnlyDictionary<string, string> Files, IReadOnlyList<string> Warnings);

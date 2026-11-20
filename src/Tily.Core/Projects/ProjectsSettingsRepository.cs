using System.Text.Json;
using Tily.Core.Session;
using Tily.Core.Worktrees;

namespace Tily.Core.Projects;

public sealed record ProjectsSettingsModel(string Root, WorktreeSettingsModel? Worktrees = null, IReadOnlyList<string>? AdditionalRoots = null)
{
    public static readonly ProjectsSettingsModel Default = new(ProjectCatalog.DefaultRoot, WorktreeSettingsModel.Default, []);
}

public sealed class ProjectsSettingsRepository
{
    public const string FileName = "projects.json";

    private readonly string _filePath;

    public ProjectsSettingsRepository(string directory)
    {
        Directory.CreateDirectory(directory);
        _filePath = Path.Combine(directory, FileName);
    }

    public string FilePath => _filePath;

    public ProjectsSettingsModel Load()
    {
        if (!File.Exists(_filePath))
        {
            Save(ProjectsSettingsModel.Default);
            return ProjectsSettingsModel.Default;
        }

        try
        {
            var settings = JsonSerializer.Deserialize<ProjectsSettingsModel>(File.ReadAllText(_filePath), SessionRepository.JsonOptions);
            return settings is null || string.IsNullOrWhiteSpace(settings.Root)
                ? ProjectsSettingsModel.Default
                : settings with { Worktrees = (settings.Worktrees ?? WorktreeSettingsModel.Default).Normalized(), AdditionalRoots = (settings.AdditionalRoots ?? []).Where(folder => !string.IsNullOrWhiteSpace(folder)).ToList() };
        }
        catch (JsonException)
        {
            return ProjectsSettingsModel.Default;
        }
    }

    public void Save(ProjectsSettingsModel settings) => AtomicFile.Write(_filePath, JsonSerializer.Serialize(settings, SessionRepository.JsonOptions));
}

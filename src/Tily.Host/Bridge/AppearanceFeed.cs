using System.Text.Json;
using Tily.Core.Appearance;
using Tily.Core.Session;
using Tily.Core.Settings;
using Tily.Core.Updates;

namespace Tily.Host.Bridge;

public sealed class AppearanceFeed
{
    private readonly Func<SettingsModel> _settings;
    private readonly Func<FeatureFlagsModel> _featureFlags;
    private readonly SettingsService _settingsService;
    private readonly Action<object> _post;
    private readonly Action<WindowColorsModel> _applyWindow;
    private readonly BackgroundQueue _queue;
    private readonly AmbianceMedia _media;
    private IReadOnlyList<string> _paths = [];
    private AppearanceStateModel? _state;
    private string? _postedProjects;

    public AppearanceFeed(Func<SettingsModel> settings, Func<FeatureFlagsModel> featureFlags, SettingsService settingsService, Action<object> post, Action<WindowColorsModel> applyWindow, Action<Exception> onError, string dataDirectory)
    {
        _media = new AmbianceMedia(dataDirectory);
        _settings = settings;
        _featureFlags = featureFlags;
        _settingsService = settingsService;
        _post = post;
        _applyWindow = applyWindow;
        _queue = new BackgroundQueue(onError);
    }

    public WindowColorsModel Start()
    {
        _state = AccentResolver.Resolve(_settings().Appearance, ReleaseChannels.Current);
        return _state.Theme.Window;
    }

    public object Hello()
    {
        _queue.Enqueue(() => _postedProjects = null);
        return new { state = _state, accentPresets = AccentPresets.All, ambiancePresets = AmbiancePresets.All };
    }

    public void Handle(BridgeCommandModel command)
    {
        switch (command.Type)
        {
            case "appearance.projects":
                _paths = command.Paths ?? [];
                RefreshProjects();
                break;
            case "appearance.importMedia":
                ImportMedia(command.Path ?? throw new InvalidOperationException("Fichier manquant."));
                break;
            case "appearance.projectColor":
                SaveProjectColor(command.Project ?? throw new InvalidOperationException("Projet manquant."), command.Color);
                break;
            case "appearance.projectOutfit":
                SaveProjectOutfit(command.Project ?? throw new InvalidOperationException("Projet manquant."), command.Outfit);
                break;
            default:
                throw new InvalidOperationException($"Commande inconnue : {command.Type}");
        }
    }

    public void Refresh()
    {
        var state = AccentResolver.Resolve(_settings().Appearance, ReleaseChannels.Current);
        if (_state is null || JsonSerializer.Serialize(state, HostBridge.JsonOptions) != JsonSerializer.Serialize(_state, HostBridge.JsonOptions))
        {
            _state = state;
            _applyWindow(state.Theme.Window);
            _post(new { type = "appearance.theme", state });
        }

        RefreshProjects();
        var kept = _settings().Appearance.Ambiance.Background.MediaPath;
        _queue.Enqueue(() => _media.Purge(kept));
    }

    private void ImportMedia(string source) =>
        _queue.Enqueue(() => _post(new { type = "appearance.mediaImported", name = _media.Import(source) }));

    private void RefreshProjects()
    {
        var settings = _settings();
        var paths = _paths;
        _queue.Enqueue(() =>
        {
            var projects = AccentResolver.ProjectsOf(settings, paths);
            var serialized = JsonSerializer.Serialize(projects, HostBridge.JsonOptions);
            if (serialized == _postedProjects)
            {
                return;
            }

            _postedProjects = serialized;
            _post(new { type = "appearance.projectsResolved", projects });
        });
    }

    private void SaveProjectColor(string project, string? color)
    {
        var settings = _settings();
        settings.Appearance = _settingsService.SaveAppearance(settings.Appearance.WithProjectColor(project, color));
        RefreshProjects();
    }

    private void SaveProjectOutfit(string project, CompanionOutfitModel? outfit)
    {
        if (!_featureFlags().CompanionCosmetics)
        {
            throw new InvalidOperationException("Les cosmétiques des compagnons sont désactivés.");
        }

        var settings = _settings();
        settings.Appearance = _settingsService.SaveAppearance(settings.Appearance.WithProjectOutfit(project, outfit));
        RefreshProjects();
    }
}

using System.Text.Json;
using Tily.Core.Appearance;
using Tily.Core.Session;
using Tily.Core.Settings;
using Tily.Core.Updates;

namespace Tily.Host.Bridge;

public sealed class AppearanceFeed
{
    private readonly Func<SettingsModel> _settings;
    private readonly SettingsService _settingsService;
    private readonly Action<object> _post;
    private readonly Action<WindowColorsModel> _applyWindow;
    private readonly BackgroundQueue _queue;
    private IReadOnlyList<string> _paths = [];
    private AppearanceStateModel? _state;
    private string? _postedProjects;

    public AppearanceFeed(Func<SettingsModel> settings, SettingsService settingsService, Action<object> post, Action<WindowColorsModel> applyWindow, Action<Exception> onError)
    {
        _settings = settings;
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
        return new { state = _state, accentPresets = AccentPresets.All };
    }

    public void Handle(BridgeCommandModel command)
    {
        switch (command.Type)
        {
            case "appearance.projects":
                _paths = command.Paths ?? [];
                RefreshProjects();
                break;
            case "appearance.projectColor":
                SaveProjectColor(command.Project ?? throw new InvalidOperationException("Projet manquant."), command.Color);
                break;
            default:
                throw new InvalidOperationException($"Commande inconnue : {command.Type}");
        }
    }

    public void Refresh()
    {
        var state = AccentResolver.Resolve(_settings().Appearance, ReleaseChannels.Current);
        if (_state is null || JsonSerializer.Serialize(state, SessionRepository.JsonOptions) != JsonSerializer.Serialize(_state, SessionRepository.JsonOptions))
        {
            _state = state;
            _applyWindow(state.Theme.Window);
            _post(new { type = "appearance.theme", state });
        }

        RefreshProjects();
    }

    private void RefreshProjects()
    {
        var settings = _settings();
        var paths = _paths;
        _queue.Enqueue(() =>
        {
            var projects = AccentResolver.ProjectsOf(settings, paths);
            var serialized = JsonSerializer.Serialize(projects, SessionRepository.JsonOptions);
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
}

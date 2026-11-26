using System.Reflection;
using System.Text.Json;
using Tily.Core.Agents;
using Tily.Core.Appearance;
using Tily.Core.Native;
using Tily.Core.Settings;
using Tily.Core.Shell;
using Tily.Core.Terminal;
using Microsoft.UI.Dispatching;

namespace Tily.Host.Bridge;

public sealed class HostServices : IDisposable
{
    public static readonly string ApplicationVersion = typeof(HostServices).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion.Split('+')[0] ?? string.Empty;

    private readonly List<HostBridge> _windows = [];
    private const string NewWindowAction = "Nouvelle fenêtre";
    private const string AttachAction = "Rattacher à la fenêtre principale";
    private const string MoveAction = "Déplacer dans cette fenêtre";

    private IReadOnlyList<PaneAgentModel> _agentStates = [];
    private DragGhostWindow? _ghost;
    private HostBridge? _dragTarget;

    public HostServices(DispatcherQueue dispatcher, string dataDirectory)
    {
        Dispatcher = dispatcher;
        DataDirectory = dataDirectory;
        SettingsService = new SettingsService(dataDirectory);
        Settings = SettingsService.Load();
        Terminals = new TerminalManager();
        Panes = new PaneRouter(Terminals);
        Agents = new AgentStateFeed(dataDirectory, Terminals, PublishAgents, CompanionsShown, PublishShinyEncounters);
        PreviewRequests = new PreviewRequestFeed(dataDirectory, PostToPane);
        Updates = new UpdateFeed(message => Main?.Post(message), ApplicationVersion, dataDirectory);
        Mcp = new McpFeed(dataDirectory, PostToPane, exception => Main?.PostError(exception));
        Activity = new ActivityFeed(Terminals);
        ApplySharedSettings(Settings);
    }

    public DispatcherQueue Dispatcher { get; }

    public string DataDirectory { get; }

    public SettingsService SettingsService { get; }

    public SettingsModel Settings { get; private set; }

    public ShellPathsModel ShellPaths { get; private set; } = ShellPathsModel.Empty;

    public TerminalManager Terminals { get; }

    public PaneRouter Panes { get; }

    public AgentStateFeed Agents { get; }

    public PreviewRequestFeed PreviewRequests { get; }

    public ActivityFeed Activity { get; }

    public UpdateFeed Updates { get; }

    public McpFeed Mcp { get; }

    public HostBridge? Main { get; private set; }

    public JsonElement? MainWorkspaces { get; private set; }

    public WindowColorsModel? WindowColors { get; set; }

    public Func<DetachedPlacementModel, HostBridge>? OpenDetached { get; set; }

    public IReadOnlyList<HostBridge> DetachedWindows => _windows.Where(window => window.Role == WindowRole.Detached).ToList();

    public void Register(HostBridge window)
    {
        _windows.Add(window);
        if (window.Role == WindowRole.Main)
        {
            Main = window;
        }
    }

    public void Unregister(HostBridge window)
    {
        _windows.Remove(window);
        Activity.Unsubscribe(window);
        if (window.Role == WindowRole.Detached)
        {
            PostDetachedTabs();
        }
    }

    public void Start()
    {
        Agents.Start();
        Mcp.Start();
    }

    public void ApplySettings(SettingsModel settings)
    {
        ApplySharedSettings(settings);
        foreach (var window in _windows.ToList())
        {
            window.ApplySettings();
        }
    }

    public void Broadcast(object message)
    {
        foreach (var window in _windows.ToList())
        {
            window.Post(message);
        }
    }

    public void PostToPane(string? paneId, object message) => ((paneId is null ? null : Panes.OwnerOf(paneId)) ?? Main)?.Post(message);

    public void RepostAgents()
    {
        foreach (var window in _windows.ToList())
        {
            window.PostAgentStates(_agentStates.Where(state => Panes.OwnerOf(state.PaneId) == window).ToList());
        }
    }

    public IReadOnlyList<string> DetachedTabs() => DetachedWindows.SelectMany(window => window.Tabs).ToList();

    public void PostDetachedTabs() => Main?.Post(new { type = "window.detached", tabs = DetachedTabs() });

    public void SetMainWorkspaces(JsonElement workspaces)
    {
        MainWorkspaces = workspaces;
        foreach (var window in DetachedWindows)
        {
            window.Post(new { type = "window.mainWorkspaces", workspaces });
        }
    }

    public void DragMove(HostBridge source, string label, bool single)
    {
        var cursor = Cursor();
        var hovered = WindowAt(cursor);
        var target = hovered == source ? null : hovered;
        if (target != _dragTarget)
        {
            _dragTarget?.Post(new { type = "window.dragLeave" });
            _dragTarget = target;
        }

        target?.PostDragOver(cursor, single);
        _ghost ??= new DragGhostWindow();
        if (hovered == source)
        {
            _ghost.HideGhost();
            return;
        }

        var action = target is null ? NewWindowAction : target.Role == WindowRole.Main ? AttachAction : MoveAction;
        _ghost.ShowAt(cursor, action, label, WindowColors);
    }

    public void DragEnd()
    {
        _ghost?.HideGhost();
        _dragTarget?.Post(new { type = "window.dragLeave" });
        _dragTarget = null;
    }

    public bool Transfer(HostBridge source, BridgeCommandModel command)
    {
        DragEnd();
        var payload = command.Payload ?? throw new InvalidOperationException("Contenu à déplacer manquant.");
        var cursor = Cursor();
        var (destination, point) = DestinationOf(command, cursor);
        if (destination == source)
        {
            return false;
        }

        destination ??= OpenDetached?.Invoke(new DetachedPlacementModel(command.AtCursor ? cursor : null, source.WindowHandle))
            ?? throw new InvalidOperationException("Impossible d’ouvrir une nouvelle fenêtre de Tily.");
        var moved = Panes.Transfer(command.Panes ?? [], source, destination);
        destination.Receive(payload, moved, source.TakeHeld(moved), point, command.Drop);
        RepostAgents();
        return true;
    }

    public void CloseDetachedWindows()
    {
        foreach (var window in DetachedWindows)
        {
            window.CloseWindow();
        }
    }

    private (HostBridge? Window, ClientPointModel? Point) DestinationOf(BridgeCommandModel command, WindowApi.ScreenPoint cursor)
    {
        if (command.Window is { } windowId)
        {
            return (_windows.FirstOrDefault(window => window.WindowId == windowId) ?? throw new InvalidOperationException("La fenêtre de destination est fermée."), null);
        }

        if (!command.AtCursor)
        {
            return (null, null);
        }

        var target = WindowAt(cursor);
        return (target, target?.ClientPointOf(cursor));
    }

    private HostBridge? WindowAt(WindowApi.ScreenPoint cursor)
    {
        var root = WindowApi.GetAncestor(WindowApi.WindowFromPoint(cursor), WindowApi.AncestorRoot);
        return _windows.FirstOrDefault(window => window.WindowHandle == root);
    }

    private static WindowApi.ScreenPoint Cursor() => WindowApi.GetCursorPos(out var point) ? point : default;

    private void PublishAgents(IReadOnlyList<PaneAgentModel> states) =>
        Dispatcher.TryEnqueue(() =>
        {
            _agentStates = states;
            RepostAgents();
        });

    private bool CompanionsShown() => Settings.Appearance.Ambiance is { Enabled: true, Companions.Enabled: true };

    private void PublishShinyEncounters(IReadOnlyList<ShinyEncounterModel> encounters) =>
        Dispatcher.TryEnqueue(() =>
        {
            foreach (var window in encounters.GroupBy(encounter => Panes.OwnerOf(encounter.PaneId) ?? Main))
            {
                window.Key?.Post(new
                {
                    type = "companions.shiny",
                    encounters = window.Select(encounter => new { pane = encounter.PaneId, subagent = encounter.SubagentId }).ToList(),
                    total = encounters[^1].Total
                });
            }
        });

    private void ApplySharedSettings(SettingsModel settings)
    {
        Settings = settings;
        ShellPaths = SettingsService.ShellPaths(settings);
        Terminals.UpdatePaths(ShellPaths);
        Updates.Configure(settings.Updates.AutoCheck);
    }

    public void Dispose()
    {
        _ghost?.Close();
        Agents.Dispose();
        PreviewRequests.Dispose();
        Mcp.Dispose();
        Activity.Dispose();
        Panes.ReleaseAll();
        Terminals.Dispose();
        Updates.LaunchPendingInstaller();
        Updates.Dispose();
    }
}

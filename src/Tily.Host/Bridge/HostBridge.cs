using System.Text;
using System.Text.Json;
using Tily.Core.Agents;
using Tily.Core.Appearance;
using Tily.Core.Context;
using Tily.Core.Native;
using Tily.Core.Projects;
using Tily.Core.Session;
using Tily.Core.Settings;
using Tily.Core.Shell;
using Tily.Core.Shortcuts;
using Tily.Core.StatusLog;
using Tily.Core.Updates;
using Tily.Core.Worktrees;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml.Controls;
using Microsoft.Web.WebView2.Core;

namespace Tily.Host.Bridge;

public sealed class HostBridge : IDisposable
{
    private const int MaxCharsPerMessage = 512 * 1024;
    private const string TextSavePrefix = """{"type":"text.save",""";
    private const string DropPrefix = """{"type":"terminal.drop",""";
    private const string TerminalCommandPrefix = "terminal.";
    private const string InvalidDroppedPath = "Chemin déposé invalide.";
    private const string AttentionDone = "done";
    private const string MainWindowId = "main";
    private const string MainWindowOnly = "Les paramètres et les mises à jour se gèrent dans la fenêtre principale de Tily.";
    private static readonly HashSet<string> MainWindowCommands = ["settings.save", "settings.export", "settings.import", "appearance.fontSize", "appearance.ambianceEnabled", "appearance.projectColor", "appearance.importMedia", "agents.installHooks", "agents.removeHooks", "mcp.install", "mcp.remove", "featureFlags.save"];
    private static readonly TimeSpan WriteDrainTimeout = TimeSpan.FromSeconds(10);
    internal static readonly JsonSerializerOptions JsonOptions = new(SessionRepository.JsonOptions) { WriteIndented = false };

    private readonly HostServices _services;
    private readonly DispatcherQueue _dispatcher;
    private readonly Action _closeWindow;
    private readonly Action _activateWindow;
    private readonly Action<string> _setTitle;
    private readonly SessionRepository _sessions;
    private readonly AttentionNotifier _notifier;
    private readonly FileExplorerFeed _files;
    private readonly FilePreviewFeed _preview;
    private readonly GitFeed _git;
    private readonly ForgeFeed _forge;
    private readonly WorktreeFeed _worktrees;
    private readonly CloneFeed _clones;
    private readonly StatusLogFeed _statusLog;
    private readonly BrowserFeed _browsers;
    private readonly AppearanceFeed _appearance;
    private readonly HeldPanes _held = new();
    private readonly List<object> _pendingReceives = [];
    private PaneTextRepository _texts;
    private readonly BackgroundQueue _writes;
    private readonly BackgroundQueue _queries;
    private CoreWebView2? _core;
    private int _flushScheduled;
    private bool _ready;
    private bool _closing;
    private DispatcherQueueTimer? _closeTimer;

    public HostBridge(HostServices services, WindowRole role, DispatcherQueue dispatcher, nint windowHandle, Action closeWindow, Action activateWindow, Action<string> setTitle, Canvas browserLayer, Action focusInterface, Action<WindowColorsModel> applyWindowColors)
    {
        _services = services;
        Role = role;
        WindowId = role == WindowRole.Main ? MainWindowId : Guid.NewGuid().ToString("N");
        WindowHandle = windowHandle;
        _dispatcher = dispatcher;
        _closeWindow = closeWindow;
        _activateWindow = activateWindow;
        _setTitle = setTitle;
        var dataDirectory = services.DataDirectory;
        _sessions = new SessionRepository(dataDirectory);
        _texts = new PaneTextRepository(dataDirectory, services.Settings.Persistence.MaxTextBytes);
        _writes = new BackgroundQueue(PostError);
        _queries = new BackgroundQueue(PostError);
        _statusLog = new StatusLogFeed(dataDirectory, _writes, Post, role == WindowRole.Main);
        _notifier = new AttentionNotifier(dispatcher, windowHandle, paneId => PostNow(new { type = "agent.join", pane = paneId }), role == WindowRole.Main);
        _notifier.Register();
        _files = new FileExplorerFeed(windowHandle, () => Settings.Editor, Post, PostError);
        _preview = new FilePreviewFeed(() => Settings.Editor, Post, PostError);
        _git = new GitFeed(Post, () => Settings.Git.AutoFetch, PostError);
        _forge = new ForgeFeed(Post, () => Settings.Worktrees.DefaultBase, _git.RefreshSoon, PostError);
        _worktrees = new WorktreeFeed(Post, () => Settings, RememberWorktreeFolder, _git.RefreshSoon, PostError, dataDirectory);
        _clones = new CloneFeed(Post, () => Settings, PostError);
        _browsers = new BrowserFeed(browserLayer, () => _core?.Environment, Post, focusInterface, () => ShortcutRules.InterceptedChords(Settings.Shortcuts));
        _appearance = new AppearanceFeed(() => Settings, () => services.FeatureFlags, services.SettingsService, Post, colors => _dispatcher.TryEnqueue(() => ApplyWindowColors(applyWindowColors, colors)), PostError, dataDirectory);
        ApplyWindowColors(applyWindowColors, _appearance.Start());
        _browsers.UpdateShortcuts();
        _appearance.Refresh();
        services.Register(this);
    }

    private void ApplyWindowColors(Action<WindowColorsModel> apply, WindowColorsModel colors)
    {
        _services.WindowColors = colors;
        apply(colors);
    }

    public WindowRole Role { get; }

    public string WindowId { get; }

    public nint WindowHandle { get; }

    public IReadOnlyList<string> Tabs { get; private set; } = [];

    private SettingsModel Settings => _services.Settings;

    public CoreWebView2Environment? WebViewEnvironment => _core?.Environment;

    public void Attach(CoreWebView2 core)
    {
        _core = core;
        core.WebMessageReceived += HandleWebMessage;
        _preview.Attach(core);
        if (Role == WindowRole.Main)
        {
            _services.Start();
        }
    }

    private void HandleWebMessage(CoreWebView2 sender, CoreWebView2WebMessageReceivedEventArgs args)
    {
        var json = args.WebMessageAsJson;
        if (json.StartsWith(DropPrefix, StringComparison.Ordinal))
        {
            ReceiveDrop(json, args.AdditionalObjects?.OfType<CoreWebView2File>().Select(file => file.Path).ToList() ?? []);
        }
        else
        {
            Receive(json);
        }
    }

    private void ReceiveDrop(string json, IReadOnlyList<string> paths)
    {
        try
        {
            var command = JsonSerializer.Deserialize<BridgeCommandModel>(json, JsonOptions) ?? throw new InvalidOperationException("Dépôt de fichiers illisible.");
            Post(new { type = "terminal.dropped", pane = RequirePane(command), text = DroppedPaths.Format(paths, command.Shell ?? ShellCatalog.DefaultShellId) });
        }
        catch (Exception exception) when (exception is JsonException or InvalidOperationException)
        {
            Post(new { type = "error", message = UserErrorMessage.Of(exception) });
        }
    }

    private void PostDroppedPath(BridgeCommandModel command)
    {
        var paneId = RequirePane(command);
        var shellId = command.Shell ?? ShellCatalog.DefaultShellId;
        if (command.Path is not { } path || path.Any(char.IsControl) || !Path.IsPathFullyQualified(path))
        {
            Post(new { type = "error", message = InvalidDroppedPath });
            return;
        }

        _queries.Enqueue(() =>
        {
            if (File.Exists(path) || Directory.Exists(path))
            {
                Post(new { type = "terminal.dropped", pane = paneId, text = DroppedPaths.Format(new[] { path }, shellId) });
            }
            else
            {
                Post(new { type = "error", message = InvalidDroppedPath });
            }
        });
    }

    private void Receive(string json)
    {
        if (json.StartsWith(BrowserFeed.Prefix, StringComparison.Ordinal))
        {
            _browsers.Receive(json);
        }
        else if (json.StartsWith(TextSavePrefix, StringComparison.Ordinal))
        {
            _writes.Enqueue(() => Handle(json));
        }
        else
        {
            Handle(json);
        }
    }

    private void Handle(string json)
    {
        BridgeCommandModel? command;
        try
        {
            command = JsonSerializer.Deserialize<BridgeCommandModel>(json, JsonOptions);
        }
        catch (JsonException)
        {
            Post(new { type = "error", message = "Message du pont illisible." });
            return;
        }

        if (command is null)
        {
            return;
        }

        try
        {
            Dispatch(command);
        }
        catch (Exception exception)
        {
            Post(new { type = "error", pane = FailedTerminalPane(command), message = UserErrorMessage.Of(exception) });
        }
    }

    public void SetWindowActive(bool active) => _notifier.WindowActive = active;

    public bool RequestClose()
    {
        if (_core is null)
        {
            return false;
        }

        if (_closing)
        {
            return true;
        }

        _closing = true;
        PostNow(new { type = "app.closing", activity = _services.Terminals.Activity(_services.Panes.PanesOf(this)), detached = Role == WindowRole.Main ? _services.DetachedTabs() : [] });
        _closeTimer = _dispatcher.CreateTimer();
        _closeTimer.Interval = TimeSpan.FromSeconds(3);
        _closeTimer.IsRepeating = false;
        _closeTimer.Tick += (_, _) => _closeWindow();
        _closeTimer.Start();
        return true;
    }

    public void CloseWindow() => _closeWindow();

    private void CancelClose()
    {
        _closing = false;
        _closeTimer?.Stop();
        _closeTimer = null;
    }

    private void Dispatch(BridgeCommandModel command)
    {
        if (Role == WindowRole.Detached)
        {
            if (command.Type is "session.save" or "text.save")
            {
                return;
            }

            if (MainWindowCommands.Contains(command.Type) || command.Type.StartsWith("update.", StringComparison.Ordinal))
            {
                throw new InvalidOperationException(MainWindowOnly);
            }
        }

        switch (command.Type)
        {
            case "app.ready":
                Ready();
                break;
            case "session.save":
                SaveSession(command);
                break;
            case "text.save":
                SaveText(command);
                break;
            case "settings.get":
                PostSettings(false);
                break;
            case "settings.save":
                SaveSettings(command);
                break;
            case "appearance.fontSize":
                SaveFontSize(command);
                break;
            case "appearance.ambianceEnabled":
                SaveAmbianceEnabled(command);
                break;
            case "featureFlags.save":
                _services.SaveFeatureFlags(command.Flags ?? throw new InvalidOperationException("Feature flags manquants."));
                break;
            case var type when type.StartsWith("appearance.", StringComparison.Ordinal):
                _appearance.Handle(command);
                break;
            case "attention.raise":
                RaiseAttention(RequirePane(command), command);
                break;
            case "attention.flash":
                _notifier.FlashWhenInactive(Settings.Notifications);
                break;
            case "attention.test":
                TestAttention(RequirePane(command), command);
                break;
            case "agents.installHooks":
                _services.Agents.Hooks.Install();
                PostSettings(false);
                break;
            case "agents.removeHooks":
                _services.Agents.Hooks.Remove();
                PostSettings(false);
                break;
            case "mcp.install":
                _services.Mcp.Install();
                PostSettings(false);
                break;
            case "mcp.remove":
                _services.Mcp.Remove();
                PostSettings(false);
                break;
            case "mcp.response":
                _services.Mcp.Receive(command);
                break;
            case "settings.export":
                _ = ExportPreferencesAsync();
                break;
            case "settings.import":
                _ = ImportPreferencesAsync();
                break;
            case "dialog.pick":
                _ = PickPathAsync(command.Field ?? throw new InvalidOperationException("Champ manquant."), command.Target);
                break;
            case "terminal.create":
                CreateTerminal(command);
                break;
            case "terminal.input":
                WriteTerminal(RequirePane(command), command.Data);
                break;
            case "terminal.resize":
                ResizeTerminal(RequirePane(command), command.Cols, command.Rows);
                break;
            case "terminal.ack":
                _services.Panes.Acknowledge(this, RequirePane(command), command.Chars);
                break;
            case "terminal.close":
                CloseOwnTerminal(RequirePane(command));
                break;
            case "terminal.dropPath":
                PostDroppedPath(command);
                break;
            case "terminal.activity":
                Post(new { type = "terminal.activityResult", request = command.Request, panes = _services.Terminals.Activity((command.Panes ?? []).Where(paneId => !_services.Panes.IsElsewhere(this, paneId))) });
                break;
            case "terminal.hold":
                _held.Hold((command.Panes ?? []).Where(paneId => _services.Panes.OwnerOf(paneId) == this));
                PostNow(new { type = "terminal.held", request = command.Request });
                break;
            case "terminal.adopted":
                ReleaseHeld(command.Panes ?? []);
                break;
            case "window.transfer":
                Transfer(command);
                break;
            case "window.summary":
                Tabs = command.Tabs ?? [];
                _services.PostDetachedTabs();
                break;
            case "window.dragMove":
                _services.DragMove(this, command.Name ?? string.Empty, command.Single);
                break;
            case "window.dragEnd":
                _services.DragEnd();
                break;
            case "window.showMainNote":
                _services.Main?.ShowNote(command.Workspace ?? throw new InvalidOperationException("Workspace manquant."));
                break;
            case "window.workspaces":
                _services.SetMainWorkspaces(command.Workspaces ?? throw new InvalidOperationException("Workspaces manquants."));
                break;
            case "projects.list":
                ListProjects(Settings.ProjectsRoot, Settings.Worktrees.FolderFor(Settings.ProjectsRoot), Settings.WorktreeFolders, Settings.AdditionalProjectsRoots);
                break;
            case "context.query":
                QueryContext(RequirePane(command), RequirePath(command));
                break;
            case "context.open":
                OpenFolder(RequirePath(command), command.Target);
                break;
            case var type when type.StartsWith("files.", StringComparison.Ordinal):
                _files.Handle(command);
                break;
            case var type when type.StartsWith("preview.", StringComparison.Ordinal):
                _preview.Handle(command);
                break;
            case var type when type.StartsWith("git.", StringComparison.Ordinal):
                _git.Handle(command);
                break;
            case var type when type.StartsWith("forge.", StringComparison.Ordinal):
                _forge.Handle(command);
                break;
            case "projects.repositories":
            case "projects.rememberRepository":
            case var type when type.StartsWith("worktrees.", StringComparison.Ordinal):
                _worktrees.Handle(command);
                break;
            case var type when type.StartsWith("clone.", StringComparison.Ordinal):
                _clones.Handle(command);
                break;
            case var type when type.StartsWith("update.", StringComparison.Ordinal):
                _services.Updates.Handle(command);
                break;
            case var type when type.StartsWith("statusLog.", StringComparison.Ordinal):
                _statusLog.Handle(command);
                break;
            case var type when type.StartsWith("activity.", StringComparison.Ordinal):
                _services.Activity.Handle(command, this);
                break;
            case "link.open":
                LocalActions.OpenLink(command.Url ?? throw new InvalidOperationException("Lien manquant."));
                break;
            case "window.close":
                _closeWindow();
                break;
            case "window.closeCancel":
                CancelClose();
                break;
            case "window.title":
                _setTitle(WindowTitle.For(command.Title));
                break;
            default:
                Post(new { type = "error", pane = FailedTerminalPane(command), message = $"Commande inconnue : {command.Type}" });
                break;
        }
    }

    private void Ready()
    {
        SendHello();
        _ready = true;
        foreach (var message in _pendingReceives)
        {
            PostNow(message);
        }

        _pendingReceives.Clear();
        if (Role == WindowRole.Main)
        {
            _services.Mcp.MarkReady();
            _services.Updates.PostState();
        }

        _services.RepostAgents();
    }

    private void Transfer(BridgeCommandModel command)
    {
        var done = false;
        try
        {
            done = _services.Transfer(this, command);
        }
        finally
        {
            if (!done)
            {
                ReleaseHeld(command.Panes ?? []);
            }

            PostNow(new { type = "window.transferred", request = command.Request, done });
        }
    }

    public IReadOnlyList<HeldPaneEventModel> TakeHeld(IEnumerable<string> panes) => _held.Release(panes);

    public void Receive(JsonElement payload, IReadOnlyList<string> panes, IReadOnlyList<HeldPaneEventModel> events, ClientPointModel? point, JsonElement? drop)
    {
        _held.Hold(panes);
        foreach (var heldEvent in events)
        {
            _held.Queue(heldEvent.PaneId, heldEvent.Message);
        }

        var message = new { type = "window.receive", payload, x = point?.X, y = point?.Y, drop };
        if (_ready)
        {
            PostNow(message);
            _activateWindow();
        }
        else
        {
            _pendingReceives.Add(message);
        }
    }

    private void ReleaseHeld(IEnumerable<string> panes)
    {
        var events = _held.Release(panes);
        Flush();
        foreach (var heldEvent in events)
        {
            PostNow(heldEvent.Message);
        }
    }

    public void PostDragOver(WindowApi.ScreenPoint cursor, bool single)
    {
        var point = ClientPointOf(cursor);
        Post(new { type = "window.dragOver", x = point.X, y = point.Y, single });
    }

    public void ShowNote(string workspaceId)
    {
        _activateWindow();
        Post(new { type = "window.showNote", workspace = workspaceId });
    }

    public ClientPointModel ClientPointOf(WindowApi.ScreenPoint screen)
    {
        var point = screen;
        WindowApi.ScreenToClient(WindowHandle, ref point);
        var scale = Math.Max(1u, WindowApi.GetDpiForWindow(WindowHandle)) / 96.0;
        return new ClientPointModel(point.X / scale, point.Y / scale);
    }

    public void PostAgentStates(IReadOnlyList<PaneAgentModel> states) => PostNow(new { type = "agent.states", panes = states });

    public void PostPaneEvent(string paneId, object message) =>
        _dispatcher.TryEnqueue(() =>
        {
            if (!_held.Queue(paneId, message))
            {
                PostNow(message);
            }
        });

    private void RaiseAttention(string paneId, BridgeCommandModel command)
    {
        var settings = Settings.Notifications;
        var done = command.Kind == AttentionDone;
        if (done && !settings.NotifyDone)
        {
            return;
        }

        Notify(paneId, new[] { command.Title ?? "Tily", command.Body }, done ? settings.DoneSound : settings.Sound, settings, done);
    }

    private void TestAttention(string paneId, BridgeCommandModel command)
    {
        var settings = (command.Notifications?.Deserialize<NotificationSettingsModel>(JsonOptions) ?? Settings.Notifications).Normalized();
        string?[] lines = command.Kind == AttentionDone
            ? ["Tily › Test", "Terminé"]
            : ["Tily › Test", "Autorisation : Bash"];
        Notify(paneId, lines, command.Kind == AttentionDone ? settings.DoneSound : settings.Sound, settings, true);
    }

    private void Notify(string paneId, IEnumerable<string?> lines, string sound, NotificationSettingsModel settings, bool force)
    {
        try
        {
            _notifier.Notify(paneId, lines, sound, settings, force);
        }
        catch (Exception exception)
        {
            Post(new { type = "error", message = UserErrorMessage.Of(exception) });
        }
    }

    public void ApplySettings()
    {
        _texts = new PaneTextRepository(_services.DataDirectory, Settings.Persistence.MaxTextBytes);
        _browsers.UpdateShortcuts();
        _appearance.Refresh();
        if (Role == WindowRole.Detached)
        {
            PostSettings(true);
        }
    }

    private void PostSettings(bool saved)
    {
        var snapshot = _services.SettingsService.Snapshot(Settings);
        Post(new
        {
            type = "settings.result",
            settings = snapshot.Settings,
            shellSettings = snapshot.Shells,
            files = snapshot.Files,
            warnings = snapshot.Warnings,
            shells = ShellCatalog.Profiles(_services.ShellPaths),
            persistence = Settings.Persistence,
            agents = _services.Agents.Describe(),
            shinyEncounters = _services.Agents.ShinyEncounters.Count,
            mcp = _services.Mcp.Describe(),
            notifications = _notifier.Describe(),
            shortcutDefaults = ShortcutSettingsModel.Default,
            saved
        });
    }

    private void SaveFontSize(BridgeCommandModel command)
    {
        Settings.Appearance = _services.SettingsService.SaveAppearance(Settings.Appearance with { FontSize = command.FontSize });
        _services.Broadcast(new { type = "appearance.changed", fontSize = Settings.Appearance.FontSize });
    }

    private void SaveAmbianceEnabled(BridgeCommandModel command)
    {
        Settings.Appearance = _services.SettingsService.SaveAppearance(Settings.Appearance with { Ambiance = Settings.Appearance.Ambiance with { Enabled = command.Enabled } });
        _services.Broadcast(new { type = "appearance.ambiance", ambiance = Settings.Appearance.Ambiance });
    }

    private void SaveSettings(BridgeCommandModel command)
    {
        var settings = command.Settings?.Deserialize<SettingsModel>(JsonOptions) ?? throw new InvalidOperationException("Réglages manquants.");
        var result = _services.SettingsService.Save(settings);
        if (!result.IsValid)
        {
            throw new InvalidOperationException($"Réglages refusés : {result.Error}");
        }

        _services.ApplySettings(settings);
        PostSettings(true);
    }

    private void SendHello()
    {
        var main = Role == WindowRole.Main;
        var loaded = main ? _sessions.Load() : null;
        var session = main ? loaded?.Session ?? SessionFactory.Initial() : null;
        if (session is not null)
        {
            _texts.MoveClosedTabText(session);
        }

        var text = main ? _texts.Load() : null;
        var recovery = string.Join(" ", new[] { loaded?.Error, text?.Error, _statusLog.LoadError }.Where(error => error is not null));
        Post(new
        {
            type = "app.hello",
            version = HostServices.ApplicationVersion,
            name = WindowTitle.ApplicationName,
            channel = ReleaseChannels.Identifier(ReleaseChannels.Current),
            window = new { detached = !main, id = WindowId, mainWorkspaces = main ? null : _services.MainWorkspaces },
            session,
            shells = ShellCatalog.Profiles(_services.ShellPaths),
            home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            text = text?.Text ?? new Dictionary<string, string>(),
            persistence = Settings.Persistence,
            appearance = Settings.Appearance,
            theme = _appearance.Hello(),
            shortcuts = Settings.Shortcuts,
            featureFlags = _services.FeatureFlags,
            statusLog = _statusLog.Entries(),
            recovery = recovery.Length > 0 ? recovery : null
        });
    }

    private void SaveSession(BridgeCommandModel command)
    {
        var element = command.Session ?? throw new InvalidOperationException("Session manquante.");
        _writes.Enqueue(() =>
        {
            var session = element.Deserialize<SessionModel>(JsonOptions) ?? throw new InvalidOperationException("Session manquante.");
            Persist(_sessions.FilePath, () =>
            {
                var result = _sessions.Save(session);
                return result.IsValid ? null : $"Session refusée : {result.Error}";
            });
        });
    }

    private void SaveText(BridgeCommandModel command)
    {
        var element = command.Text ?? throw new InvalidOperationException("Texte des terminaux manquant.");
        var keep = command.Keep ?? throw new InvalidOperationException("Liste des panes à conserver manquante.");
        var texts = _texts;
        _writes.Enqueue(() =>
        {
            var text = element.Deserialize<Dictionary<string, string>>(JsonOptions) ?? throw new InvalidOperationException("Texte des terminaux manquant.");
            Persist(texts.DirectoryPath, () =>
            {
                texts.Save(text, keep);
                return null;
            });
        });
    }

    private void ListProjects(string root, string worktreeFolder, IReadOnlyList<WorktreeProjectFolderModel> projectFolders, IReadOnlyList<string> additionalRoots) =>
        _queries.Enqueue(() =>
        {
            var projects = ProjectCatalog.List(root, worktreeFolder, projectFolders, additionalRoots);
            Post(new { type = "projects.listed", root = projects.Root, projects = projects.Projects, error = projects.Error, additionalRoots = projects.AdditionalRoots });
        });

    private void RememberWorktreeFolder(string project, string folder) =>
        _dispatcher.TryEnqueue(() =>
        {
            try
            {
                _services.SettingsService.RememberWorktreeFolder(Settings, project, folder);
            }
            catch (Exception exception)
            {
                PostNow(new { type = "error", message = UserErrorMessage.Of(exception) });
            }
        });

    private void QueryContext(string paneId, string path) =>
        _queries.Enqueue(() => Post(new { type = "context.result", pane = paneId, path, git = GitContext.Resolve(path) }));

    public void PostError(Exception exception) => Post(new { type = "error", message = UserErrorMessage.Of(exception) });

    private void Persist(string filePath, Func<string?> write)
    {
        string? failure;
        try
        {
            failure = write();
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            failure = $"Impossible d’écrire {filePath} : {exception.Message}";
        }

        if (failure is null)
        {
            Post(new { type = "session.saved" });
        }
        else
        {
            Post(new { type = "session.saveFailed", message = failure });
        }
    }

    private void CreateTerminal(BridgeCommandModel command)
    {
        var paneId = RequirePane(command);
        if (_services.Panes.IsElsewhere(this, paneId))
        {
            throw new InvalidOperationException("Ce pane est déjà ouvert dans une autre fenêtre de Tily.");
        }

        CloseTerminal(paneId);
        _services.Panes.Start(this, paneId);
        var cwd = command.Cwd ?? string.Empty;
        _services.Terminals.Start(paneId, command.Shell ?? ShellCatalog.DefaultShellId, cwd, command.Cols, command.Rows, command.Command);
        if (cwd.Length > 0 && !Directory.Exists(cwd))
        {
            Post(new { type = "terminal.pathMissing", pane = paneId, path = cwd, fallback = PathFallback.NearestExisting(cwd) });
        }
    }

    private void WriteTerminal(string paneId, string? data)
    {
        if (!_services.Panes.IsElsewhere(this, paneId))
        {
            _services.Terminals.Require(paneId).Write(Encoding.UTF8.GetBytes(data ?? string.Empty));
        }
    }

    private void ResizeTerminal(string paneId, int columns, int rows)
    {
        if (!_services.Panes.IsElsewhere(this, paneId))
        {
            _services.Terminals.Require(paneId).Resize(columns, rows);
        }
    }

    private void CloseOwnTerminal(string paneId)
    {
        if (!_services.Panes.IsElsewhere(this, paneId))
        {
            CloseTerminal(paneId);
        }
    }

    private void CloseTerminal(string paneId)
    {
        _services.Panes.Close(paneId);
        _services.Terminals.Stop(paneId);
        _services.Agents.Forget(paneId);
    }

    public void ScheduleFlush()
    {
        if (Interlocked.CompareExchange(ref _flushScheduled, 1, 0) == 0)
        {
            _dispatcher.TryEnqueue(DispatcherQueuePriority.High, Flush);
        }
    }

    private void Flush()
    {
        Interlocked.Exchange(ref _flushScheduled, 0);
        foreach (var buffer in _services.Panes.BuffersOf(this))
        {
            if (_held.Contains(buffer.PaneId))
            {
                continue;
            }

            var text = buffer.Take();
            if (text is null)
            {
                continue;
            }

            for (var offset = 0; offset < text.Length; offset += MaxCharsPerMessage)
            {
                var length = Math.Min(MaxCharsPerMessage, text.Length - offset);
                PostNow(new { type = "terminal.output", pane = buffer.PaneId, data = text.Substring(offset, length) });
            }
        }
    }

    private async Task ExportPreferencesAsync()
    {
        try
        {
            var path = await PathPicker.SaveJsonAsync(WindowHandle, "tily-preferences");
            if (path is null)
            {
                return;
            }

            _services.SettingsService.Export(Settings, path);
            PostNow(new { type = "settings.exported", path });
        }
        catch (Exception exception)
        {
            PostNow(new { type = "error", message = $"Export des préférences impossible : {exception.Message}" });
        }
    }

    private async Task ImportPreferencesAsync()
    {
        try
        {
            var path = await PathPicker.PickJsonAsync(WindowHandle);
            if (path is null)
            {
                return;
            }

            var result = _services.SettingsService.Import(path);
            if (result.Settings is null)
            {
                PostNow(new { type = "error", message = result.Error });
                return;
            }

            PostNow(new { type = "settings.imported", settings = result.Settings, path, warnings = result.Warnings });
        }
        catch (Exception exception)
        {
            PostNow(new { type = "error", message = $"Import des préférences impossible : {exception.Message}" });
        }
    }

    private async Task PickPathAsync(string field, string? target)
    {
        try
        {
            var path = await PathPicker.PickAsync(WindowHandle, target);
            if (path is not null)
            {
                PostNow(new { type = "dialog.picked", field, path });
            }
        }
        catch (Exception exception)
        {
            PostNow(new { type = "error", message = $"Impossible d’ouvrir le sélecteur : {exception.Message}" });
        }
    }

    private void OpenFolder(string path, string? target)
    {
        switch (target)
        {
            case "editor":
                LocalActions.OpenInEditor(path, Settings.Editor);
                break;
            case "explorer":
                LocalActions.OpenInExplorer(path);
                break;
            default:
                throw new InvalidOperationException($"Cible d’ouverture inconnue : {target}");
        }
    }

    private static string RequirePath(BridgeCommandModel command) =>
        command.Path ?? throw new InvalidOperationException("Chemin manquant.");

    private static string RequirePane(BridgeCommandModel command) =>
        command.Pane ?? throw new InvalidOperationException("Identifiant de pane manquant.");

    private static string? FailedTerminalPane(BridgeCommandModel command) =>
        command.Type is { } type && type.StartsWith(TerminalCommandPrefix, StringComparison.Ordinal) ? command.Pane : null;

    public void Post(object message) => _dispatcher.TryEnqueue(() => PostNow(message));

    private void PostNow(object message) => _core?.PostWebMessageAsJson(JsonSerializer.Serialize(message, JsonOptions));

    public void Dispose()
    {
        _writes.Drain(WriteDrainTimeout);
        if (Role == WindowRole.Detached)
        {
            foreach (var paneId in _services.Panes.PanesOf(this))
            {
                CloseTerminal(paneId);
            }
        }

        _notifier.Dispose();
        _files.Dispose();
        _preview.Dispose();
        _browsers.Dispose();
        _git.Dispose();
        _core = null;
        _services.Unregister(this);
    }
}

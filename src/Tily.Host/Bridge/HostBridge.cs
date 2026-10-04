using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;
using Tily.Core.Agents;
using Tily.Core.Context;
using Tily.Core.Mcp;
using Tily.Core.Projects;
using Tily.Core.Session;
using Tily.Core.Settings;
using Tily.Core.Shell;
using Tily.Core.StatusLog;
using Tily.Core.Terminal;
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
    private static readonly string ApplicationVersion = typeof(HostBridge).Assembly.GetName().Version?.ToString(3) ?? string.Empty;
    private static readonly TimeSpan WriteDrainTimeout = TimeSpan.FromSeconds(10);
    private static readonly JsonSerializerOptions JsonOptions = SessionRepository.JsonOptions;

    private readonly DispatcherQueue _dispatcher;
    private readonly Action _closeWindow;
    private readonly Action<string> _setTitle;
    private readonly nint _windowHandle;
    private readonly string _dataDirectory;
    private readonly SessionClaim _session;
    private readonly SessionRepository _sessions;
    private readonly SettingsService _settingsService;
    private readonly TerminalManager _terminals;
    private readonly AgentStateFeed _agents;
    private readonly AttentionNotifier _notifier;
    private readonly FileExplorerFeed _files;
    private readonly FilePreviewFeed _preview;
    private readonly PreviewRequestFeed _previewRequests;
    private readonly GitFeed _git;
    private readonly WorktreeFeed _worktrees;
    private readonly UpdateFeed _updates;
    private readonly StatusLogFeed _statusLog;
    private readonly McpFeed _mcp;
    private readonly PreferencesWatcher _preferences;
    private readonly BrowserFeed _browsers;
    private SettingsModel _settings;
    private ShellPathsModel _shellPaths = ShellPathsModel.Empty;
    private PersistenceSettingsModel _persistence = PersistenceSettingsModel.Default;
    private PaneTextRepository _texts;
    private readonly ConcurrentDictionary<string, PaneOutputBuffer> _buffers = new();
    private readonly BackgroundQueue _writes;
    private readonly BackgroundQueue _queries;
    private CoreWebView2? _core;
    private int _flushScheduled;
    private bool _closing;
    private DispatcherQueueTimer? _closeTimer;

    public HostBridge(DispatcherQueue dispatcher, string dataDirectory, SessionClaim session, nint windowHandle, Action closeWindow, Action<string> setTitle, Canvas browserLayer, Action focusInterface)
    {
        _dispatcher = dispatcher;
        _windowHandle = windowHandle;
        _closeWindow = closeWindow;
        _setTitle = setTitle;
        _dataDirectory = dataDirectory;
        _session = session;
        _sessions = new SessionRepository(session.Directory);
        _settingsService = new SettingsService(dataDirectory);
        _settings = _settingsService.Load();
        _texts = new PaneTextRepository(session.Directory, _persistence.MaxTextBytes);
        var pipeName = McpEndpoint.InstancePipeName(dataDirectory, session.Id);
        _terminals = new TerminalManager(environment: new Dictionary<string, string> { [McpEndpoint.PipeVariable] = pipeName });
        _writes = new BackgroundQueue(PostBackgroundError);
        _queries = new BackgroundQueue(PostBackgroundError);
        _statusLog = new StatusLogFeed(session.Directory, _writes, Post);
        _agents = new AgentStateFeed(dataDirectory, _terminals, Post);
        _notifier = new AttentionNotifier(dispatcher, windowHandle, paneId => PostNow(new { type = "agent.join", pane = paneId }));
        _notifier.Register();
        _files = new FileExplorerFeed(windowHandle, () => _settings.Editor, Post, PostBackgroundError);
        _preview = new FilePreviewFeed(() => _settings.Editor, Post, PostBackgroundError);
        _previewRequests = new PreviewRequestFeed(dataDirectory, _terminals.Has, Post);
        _git = new GitFeed(Post, () => _settings.Git.AutoFetch, PostBackgroundError);
        _worktrees = new WorktreeFeed(Post, () => _settings, RememberWorktreeFolder, _git.RefreshSoon, PostBackgroundError, dataDirectory);
        _updates = new UpdateFeed(Post, ApplicationVersion, dataDirectory, session.Id);
        _mcp = new McpFeed(pipeName, McpEndpoint.PipeName(dataDirectory), _terminals.Has, Post, PostBackgroundError);
        _preferences = new PreferencesWatcher(dataDirectory, () => _dispatcher.TryEnqueue(ReloadSettings));
        _browsers = new BrowserFeed(browserLayer, () => _core?.Environment, Post, focusInterface);
        ApplySettings(_settings);
        _terminals.OutputReceived += HandleOutput;
        _terminals.CurrentDirectoryChanged += HandleCurrentDirectoryChanged;
        _terminals.Exited += (paneId, code) => Post(new { type = "terminal.exit", pane = paneId, code });
    }

    public void Attach(CoreWebView2 core)
    {
        _core = core;
        core.WebMessageReceived += HandleWebMessage;
        _preview.Attach(core);
        _agents.Start();
        _mcp.Start();
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
                Post(new { type = "terminal.dropped", pane = paneId, text = DroppedPaths.Format([path], shellId) });
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
        PostNow(new { type = "app.closing", activity = _terminals.Activity() });
        _closeTimer = _dispatcher.CreateTimer();
        _closeTimer.Interval = TimeSpan.FromSeconds(3);
        _closeTimer.IsRepeating = false;
        _closeTimer.Tick += (_, _) => _closeWindow();
        _closeTimer.Start();
        return true;
    }

    private void CancelClose()
    {
        _closing = false;
        _closeTimer?.Stop();
        _closeTimer = null;
    }

    private void Dispatch(BridgeCommandModel command)
    {
        switch (command.Type)
        {
            case "app.ready":
                SendHello();
                _mcp.MarkReady();
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
            case "attention.raise":
                RaiseAttention(RequirePane(command), command);
                break;
            case "attention.flash":
                _notifier.FlashWhenInactive(_settings.Notifications);
                break;
            case "attention.test":
                TestAttention(RequirePane(command), command);
                break;
            case "agents.installHooks":
                _agents.Hooks.Install();
                PostSettings(false);
                break;
            case "agents.removeHooks":
                _agents.Hooks.Remove();
                PostSettings(false);
                break;
            case "mcp.install":
                _mcp.Install();
                PostSettings(false);
                break;
            case "mcp.remove":
                _mcp.Remove();
                PostSettings(false);
                break;
            case "mcp.response":
                _mcp.Receive(command);
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
                _terminals.Require(RequirePane(command)).Write(Encoding.UTF8.GetBytes(command.Data ?? string.Empty));
                break;
            case "terminal.resize":
                _terminals.Require(RequirePane(command)).Resize(command.Cols, command.Rows);
                break;
            case "terminal.ack":
                if (_buffers.TryGetValue(RequirePane(command), out var buffer))
                {
                    buffer.Acknowledge(command.Chars);
                }

                break;
            case "terminal.close":
                CloseTerminal(RequirePane(command));
                break;
            case "terminal.dropPath":
                PostDroppedPath(command);
                break;
            case "terminal.activity":
                Post(new { type = "terminal.activityResult", request = command.Request, panes = _terminals.Activity(command.Panes ?? []) });
                break;
            case "projects.list":
                ListProjects(_settings.ProjectsRoot, _settings.Worktrees.FolderFor(_settings.ProjectsRoot), _settings.WorktreeFolders);
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
            case "projects.repositories":
            case "projects.rememberRepository":
            case var type when type.StartsWith("worktrees.", StringComparison.Ordinal):
                _worktrees.Handle(command);
                break;
            case var type when type.StartsWith("update.", StringComparison.Ordinal):
                _updates.Handle(command);
                break;
            case var type when type.StartsWith("statusLog.", StringComparison.Ordinal):
                _statusLog.Handle(command);
                break;
            case "link.open":
                LocalActions.OpenLink(command.Url ?? throw new InvalidOperationException("Lien manquant."));
                break;
            case "window.close":
                _closeWindow();
                break;
            case "window.new":
                WindowLauncher.OpenNew();
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

    private void RaiseAttention(string paneId, BridgeCommandModel command)
    {
        var settings = _settings.Notifications;
        var done = command.Kind == AttentionDone;
        if (done && !settings.NotifyDone)
        {
            return;
        }

        Notify(paneId, [command.Title ?? "Tily", command.Body, command.Location], done ? settings.DoneSound : settings.Sound, settings, done);
    }

    private void TestAttention(string paneId, BridgeCommandModel command)
    {
        var settings = (command.Notifications?.Deserialize<NotificationSettingsModel>(JsonOptions) ?? _settings.Notifications).Normalized();
        string?[] lines = command.Kind == AttentionDone
            ? ["Tily : test de fin", "Voici l’apparence d’un agent qui a terminé.", command.Location]
            : ["Tily : test de notification", "Voici l’apparence d’une demande d’attention.", command.Location];
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

    private void ApplySettings(SettingsModel settings)
    {
        _settings = settings;
        _shellPaths = SettingsService.ShellPaths(settings);
        _persistence = settings.Persistence;
        _texts = new PaneTextRepository(_session.Directory, _persistence.MaxTextBytes);
        _terminals.UpdatePaths(_shellPaths);
        _updates.Configure(settings.Updates.AutoCheck);
    }

    private void ReloadSettings()
    {
        SettingsModel loaded;
        try
        {
            loaded = _settingsService.Load();
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            _preferences.RetrySoon();
            return;
        }

        if (!SettingsService.SameValues(loaded, _settings))
        {
            ApplySettings(loaded);
            PostSettings(false, true);
        }
    }

    private void PostSettings(bool saved, bool external = false)
    {
        var snapshot = _settingsService.Snapshot(_settings);
        Post(new
        {
            type = "settings.result",
            settings = snapshot.Settings,
            shellSettings = snapshot.Shells,
            files = snapshot.Files,
            warnings = snapshot.Warnings,
            shells = ShellCatalog.Profiles(_shellPaths),
            persistence = _persistence,
            agents = _agents.Describe(),
            mcp = _mcp.Describe(),
            notifications = _notifier.Describe(),
            saved,
            external
        });
    }

    private void SaveFontSize(BridgeCommandModel command)
    {
        _settings.Appearance = _settingsService.SaveAppearance(new AppearanceSettingsModel(command.FontSize));
        Post(new { type = "appearance.changed", fontSize = _settings.Appearance.FontSize });
    }

    private void SaveSettings(BridgeCommandModel command)
    {
        var settings = command.Settings?.Deserialize<SettingsModel>(JsonOptions) ?? throw new InvalidOperationException("Réglages manquants.");
        var result = _settingsService.Save(settings, command.BaseSettings?.Deserialize<SettingsModel>(JsonOptions));
        if (!result.IsValid)
        {
            throw new InvalidOperationException($"Réglages refusés : {result.Error}");
        }

        ApplySettings(_settingsService.Load());
        PostSettings(true);
    }

    private void SendHello()
    {
        var loaded = _sessions.Load();
        var session = loaded.Session ?? SessionFactory.InitialLike(new SessionStore(_dataDirectory).Latest(_session.Id));
        _texts.MoveClosedTabText(session);
        var text = _texts.Load();
        var recovery = string.Join(" ", new[] { loaded.Error, text.Error, _statusLog.LoadError }.Where(error => error is not null));
        Post(new
        {
            type = "app.hello",
            version = ApplicationVersion,
            session,
            shells = ShellCatalog.Profiles(_shellPaths),
            home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            text = text.Text,
            persistence = _persistence,
            appearance = _settings.Appearance,
            statusLog = _statusLog.Entries(),
            recovery = recovery.Length > 0 ? recovery : null
        });
        _updates.PostState();
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

    private void ListProjects(string root, string worktreeFolder, IReadOnlyList<WorktreeProjectFolderModel> projectFolders) =>
        _queries.Enqueue(() =>
        {
            var projects = ProjectCatalog.List(root, worktreeFolder, projectFolders);
            Post(new { type = "projects.listed", root = projects.Root, projects = projects.Projects, error = projects.Error });
        });

    private void RememberWorktreeFolder(string project, string folder) =>
        _dispatcher.TryEnqueue(() =>
        {
            try
            {
                _settingsService.RememberWorktreeFolder(_settings, project, folder);
            }
            catch (Exception exception)
            {
                PostNow(new { type = "error", message = UserErrorMessage.Of(exception) });
            }
        });

    private void QueryContext(string paneId, string path) =>
        _queries.Enqueue(() => Post(new { type = "context.result", pane = paneId, path, git = GitContext.Resolve(path) }));

    private void PostBackgroundError(Exception exception) => Post(new { type = "error", message = UserErrorMessage.Of(exception) });

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
        CloseTerminal(paneId);
        _buffers[paneId] = new PaneOutputBuffer(paneId);
        var cwd = command.Cwd ?? string.Empty;
        _terminals.Start(paneId, command.Shell ?? ShellCatalog.DefaultShellId, cwd, command.Cols, command.Rows, command.Command);
        if (cwd.Length > 0 && !Directory.Exists(cwd))
        {
            Post(new { type = "terminal.pathMissing", pane = paneId, path = cwd, fallback = PathFallback.NearestExisting(cwd) });
        }
    }

    private void HandleCurrentDirectoryChanged(string paneId, string path)
    {
        Post(new { type = "terminal.cwd", pane = paneId, path });
        foreach (var missing in _terminals.MissingDirectories())
        {
            Post(new { type = "terminal.pathMissing", pane = missing.PaneId, path = missing.Path, fallback = missing.Fallback });
        }
    }

    private void CloseTerminal(string paneId)
    {
        if (_buffers.TryRemove(paneId, out var buffer))
        {
            buffer.Release();
        }

        _terminals.Stop(paneId);
        _agents.Forget(paneId);
    }

    private void HandleOutput(string paneId, ReadOnlyMemory<byte> data)
    {
        if (!_buffers.TryGetValue(paneId, out var buffer))
        {
            return;
        }

        buffer.Append(data.Span);
        if (Interlocked.CompareExchange(ref _flushScheduled, 1, 0) == 0)
        {
            _dispatcher.TryEnqueue(DispatcherQueuePriority.High, Flush);
        }
    }

    private void Flush()
    {
        Interlocked.Exchange(ref _flushScheduled, 0);
        foreach (var buffer in _buffers.Values)
        {
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
            var path = await PathPicker.SaveJsonAsync(_windowHandle, "tily-preferences");
            if (path is null)
            {
                return;
            }

            _settingsService.Export(_settings, path);
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
            var path = await PathPicker.PickJsonAsync(_windowHandle);
            if (path is null)
            {
                return;
            }

            var result = _settingsService.Import(path);
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
            var path = await PathPicker.PickAsync(_windowHandle, target);
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
                LocalActions.OpenInEditor(path, _settings.Editor);
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

    private void Post(object message) => _dispatcher.TryEnqueue(() => PostNow(message));

    private void PostNow(object message) => _core?.PostWebMessageAsJson(JsonSerializer.Serialize(message, JsonOptions));

    public void Dispose()
    {
        _writes.Drain(WriteDrainTimeout);
        _agents.Dispose();
        _notifier.Dispose();
        _files.Dispose();
        _preview.Dispose();
        _previewRequests.Dispose();
        _mcp.Dispose();
        _preferences.Dispose();
        _browsers.Dispose();
        _git.Dispose();
        foreach (var buffer in _buffers.Values)
        {
            buffer.Release();
        }

        _terminals.Dispose();
        _updates.LaunchPendingInstaller();
        _updates.Dispose();
    }
}

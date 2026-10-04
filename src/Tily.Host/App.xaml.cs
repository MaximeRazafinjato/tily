using Tily.Core.Agents;
using Tily.Core.Mcp;
using Tily.Core.Session;
using Tily.Core.Updates;
using Microsoft.UI.Xaml;

namespace Tily.Host;

public partial class App : Application
{
    private const string RemoveClaudeHooksArgument = "--remove-claude-hooks";

    public static string DataDirectory { get; } = ResolveDataDirectory();

    private Window? _window;

    public App()
    {
        Environment.SetEnvironmentVariable("WEBVIEW2_USER_DATA_FOLDER", Path.Combine(DataDirectory, "WebView2"));
        InitializeComponent();
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        var arguments = Environment.GetCommandLineArgs();
        if (arguments.Contains(RemoveClaudeHooksArgument, StringComparer.OrdinalIgnoreCase))
        {
            RemoveClaudeHooks();
            Exit();
            return;
        }

        var store = new SessionStore(DataDirectory);
        var startup = InstanceStartup.Resolve(store, arguments, ClearTransientFiles);
        if (startup.Claim is null)
        {
            Exit();
            return;
        }

        _window = new MainWindow(store, startup.Claim);
        _window.Activate();
        foreach (var session in startup.Others)
        {
            RestoreWindow(session);
        }
    }

    private static void RestoreWindow(string session)
    {
        try
        {
            WindowLauncher.Restore(session);
        }
        catch (Exception exception) when (exception is System.ComponentModel.Win32Exception or InvalidOperationException)
        {
        }
    }

    private static void ClearTransientFiles()
    {
        new AgentStateRepository(DataDirectory).Clear();
        new PreviewRequestRepository(DataDirectory).Clear();
        UpdateClient.Clean(UpdateClient.DownloadDirectory(DataDirectory));
        new RestartCoordination(DataDirectory).Clear();
    }

    private static string ResolveDataDirectory()
    {
        var directory = McpEndpoint.DataDirectoryFromEnvironment();
        if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(McpEndpoint.DataDirectoryVariable)))
        {
            Environment.SetEnvironmentVariable(McpEndpoint.DataDirectoryVariable, directory);
        }

        return directory;
    }

    private static void RemoveClaudeHooks()
    {
        try
        {
            new ClaudeHooksInstaller(Path.Combine(AppContext.BaseDirectory, "hooks", "tily-agent-state.ps1")).RemoveIfPresent();
        }
        catch (Exception exception) when (exception is InvalidOperationException or IOException or UnauthorizedAccessException)
        {
        }

        try
        {
            new ClaudeMcpInstaller(Path.Combine(AppContext.BaseDirectory, ClaudeMcpInstaller.ExecutableName)).RemoveIfPresent();
        }
        catch (Exception exception) when (exception is InvalidOperationException or IOException or UnauthorizedAccessException)
        {
        }
    }
}

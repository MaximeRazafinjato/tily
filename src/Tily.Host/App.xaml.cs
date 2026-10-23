using Tily.Core.Agents;
using Tily.Core.Mcp;
using Tily.Core.Updates;
using Microsoft.UI.Xaml;
using Microsoft.Win32;

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
        if (Environment.GetCommandLineArgs().Contains(RemoveClaudeHooksArgument, StringComparer.OrdinalIgnoreCase))
        {
            RemoveClaudeHooks();
            Exit();
            return;
        }

        _window = new MainWindow();
        _window.Activate();
    }

    private static bool IsOtherChannelInstalled()
    {
        var key = ReleaseChannels.UninstallKey(ReleaseChannels.Current == ReleaseChannel.Beta ? ReleaseChannel.Stable : ReleaseChannel.Beta);
        return new[] { RegistryHive.CurrentUser, RegistryHive.LocalMachine }.Any(hive =>
        {
            using var root = RegistryKey.OpenBaseKey(hive, RegistryView.Registry64);
            using var uninstall = root.OpenSubKey(key);
            return uninstall is not null;
        });
    }

    private static string ResolveDataDirectory()
    {
        if (ReleaseChannels.Current == ReleaseChannel.Beta && string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(McpEndpoint.DataDirectoryVariable)))
        {
            Environment.SetEnvironmentVariable(McpEndpoint.DataDirectoryVariable, Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), ReleaseChannels.ApplicationName(ReleaseChannel.Beta)));
        }

        var directory = McpEndpoint.DataDirectoryFromEnvironment();
        if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(McpEndpoint.DataDirectoryVariable)))
        {
            Environment.SetEnvironmentVariable(McpEndpoint.DataDirectoryVariable, directory);
        }

        return directory;
    }

    private static void RemoveClaudeHooks()
    {
        if (IsOtherChannelInstalled())
        {
            return;
        }

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

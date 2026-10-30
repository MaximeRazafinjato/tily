using Tily.Core.Appearance;
using Tily.Host.Bridge;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.Web.WebView2.Core;
using Windows.Graphics;
using Windows.UI;

namespace Tily.Host;

public sealed partial class MainWindow : Window
{
    private const string VirtualHost = "tily.example";
    private const string DevServerVariable = "TILY_WEB_DEV_URL";
    private readonly HostBridge _bridge;
    private readonly string _startUrl = ResolveStartUrl();
    private bool _closeConfirmed;

    public MainWindow()
    {
        InitializeComponent();
        AppWindow.Resize(new SizeInt32(1480, 900));
        if (AppWindow.Presenter is OverlappedPresenter presenter)
        {
            presenter.Maximize();
        }

        AppWindow.SetIcon(Path.Combine(AppContext.BaseDirectory, "Assets", "Tily.ico"));
        _bridge = new HostBridge(DispatcherQueue, App.DataDirectory, WinRT.Interop.WindowNative.GetWindowHandle(this), ForceClose, SetTitle, BrowserLayer, FocusInterface, ApplyWindowColors);
        View.AllowDrop = true;
        Closed += HandleClosed;
        Activated += HandleActivated;
        _ = InitializeWebViewAsync();
    }

    private async Task InitializeWebViewAsync()
    {
        await View.EnsureCoreWebView2Async();
        var core = View.CoreWebView2;
        core.Settings.AreBrowserAcceleratorKeysEnabled = false;
        core.Settings.AreDefaultContextMenusEnabled = false;
        core.Settings.IsStatusBarEnabled = false;
        core.Settings.IsZoomControlEnabled = false;
        core.Settings.IsGeneralAutofillEnabled = false;
        core.Settings.IsPasswordAutosaveEnabled = false;
        core.PermissionRequested += HandlePermissionRequested;
        core.NavigationStarting += HandleNavigationStarting;
        core.NewWindowRequested += HandleNewWindowRequested;
        core.SetVirtualHostNameToFolderMapping(VirtualHost, Path.Combine(AppContext.BaseDirectory, "wwwroot"), CoreWebView2HostResourceAccessKind.Allow);
        _bridge.Attach(core);
        core.Navigate(_startUrl);
        View.Focus(FocusState.Programmatic);
    }

    private void SetTitle(string title) => Title = title;

    private void FocusInterface() => View.Focus(FocusState.Programmatic);

    private void ApplyWindowColors(WindowColorsModel colors)
    {
        var paper = ColorOf(colors.Background);
        var ink = ColorOf(colors.Foreground);
        var muted = ColorOf(colors.InactiveForeground);
        View.DefaultBackgroundColor = paper;
        var titleBar = AppWindow.TitleBar;
        titleBar.BackgroundColor = paper;
        titleBar.InactiveBackgroundColor = paper;
        titleBar.ForegroundColor = ink;
        titleBar.InactiveForegroundColor = muted;
        titleBar.ButtonBackgroundColor = paper;
        titleBar.ButtonInactiveBackgroundColor = paper;
        titleBar.ButtonForegroundColor = ink;
        titleBar.ButtonInactiveForegroundColor = muted;
        titleBar.ButtonHoverBackgroundColor = ColorOf(colors.HoverBackground);
        titleBar.ButtonHoverForegroundColor = ink;
    }

    private static Color ColorOf(string hex)
    {
        var (red, green, blue) = HexColor.Channels(hex);
        return Color.FromArgb(255, (byte)red, (byte)green, (byte)blue);
    }

    private static string ResolveStartUrl()
    {
        var devServer = Environment.GetEnvironmentVariable(DevServerVariable);
        return string.IsNullOrWhiteSpace(devServer) ? $"https://{VirtualHost}/index.html" : devServer;
    }

    private void HandleNavigationStarting(CoreWebView2 sender, CoreWebView2NavigationStartingEventArgs args) => args.Cancel = !IsSameOrigin(args.Uri, _startUrl);

    private static void HandleNewWindowRequested(CoreWebView2 sender, CoreWebView2NewWindowRequestedEventArgs args) => args.Handled = true;

    private static bool IsSameOrigin(string candidate, string reference) =>
        Uri.TryCreate(candidate, UriKind.Absolute, out var candidateUri)
        && Uri.TryCreate(reference, UriKind.Absolute, out var referenceUri)
        && Uri.Compare(candidateUri, referenceUri, UriComponents.SchemeAndServer, UriFormat.Unescaped, StringComparison.OrdinalIgnoreCase) == 0;

    private static void HandlePermissionRequested(CoreWebView2 sender, CoreWebView2PermissionRequestedEventArgs args)
    {
        if (args.PermissionKind == CoreWebView2PermissionKind.ClipboardRead)
        {
            args.State = CoreWebView2PermissionState.Allow;
        }
    }

    private void HandleActivated(object sender, WindowActivatedEventArgs args)
    {
        var active = args.WindowActivationState != WindowActivationState.Deactivated;
        _bridge.SetWindowActive(active);
        if (active)
        {
            View.Focus(FocusState.Programmatic);
        }
    }

    private void ForceClose()
    {
        if (_closeConfirmed)
        {
            return;
        }

        _closeConfirmed = true;
        Close();
    }

    private void HandleClosed(object sender, WindowEventArgs args)
    {
        if (!_closeConfirmed && _bridge.RequestClose())
        {
            args.Handled = true;
            return;
        }

        _bridge.Dispose();
    }
}

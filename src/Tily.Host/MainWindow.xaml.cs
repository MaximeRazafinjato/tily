using Tily.Core.Session;
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
    private static readonly Color Paper = Color.FromArgb(255, 0x17, 0x19, 0x1B);
    private static readonly Color Ink = Color.FromArgb(255, 0xD8, 0xDB, 0xD7);
    private static readonly Color Muted = Color.FromArgb(255, 0x84, 0x8B, 0x87);
    private static readonly Color Hover = Color.FromArgb(255, 0x24, 0x28, 0x2A);
    private readonly HostBridge _bridge;
    private readonly SessionStore _store;
    private readonly SessionClaim _session;
    private readonly nint _handle;
    private readonly string _startUrl = ResolveStartUrl();
    private bool _closeConfirmed;

    public MainWindow(SessionStore store, SessionClaim session)
    {
        _store = store;
        _session = session;
        InitializeComponent();
        _handle = WinRT.Interop.WindowNative.GetWindowHandle(this);
        var placement = WindowPlacementKeeper.Restore(_handle, session.Directory);
        if (placement is null)
        {
            AppWindow.Resize(new SizeInt32(1480, 900));
        }

        if ((placement?.Maximized ?? true) && AppWindow.Presenter is OverlappedPresenter presenter)
        {
            presenter.Maximize();
        }

        AppWindow.SetIcon(Path.Combine(AppContext.BaseDirectory, "Assets", "Tily.ico"));
        ApplyDarkTitleBar();
        _bridge = new HostBridge(DispatcherQueue, App.DataDirectory, session, _handle, ForceClose, SetTitle, BrowserLayer, FocusInterface);
        View.AllowDrop = true;
        Closed += HandleClosed;
        Activated += HandleActivated;
        _ = InitializeWebViewAsync();
    }

    private async Task InitializeWebViewAsync()
    {
        View.DefaultBackgroundColor = Paper;
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

    private void ApplyDarkTitleBar()
    {
        var titleBar = AppWindow.TitleBar;
        titleBar.BackgroundColor = Paper;
        titleBar.InactiveBackgroundColor = Paper;
        titleBar.ForegroundColor = Ink;
        titleBar.InactiveForegroundColor = Muted;
        titleBar.ButtonBackgroundColor = Paper;
        titleBar.ButtonInactiveBackgroundColor = Paper;
        titleBar.ButtonForegroundColor = Ink;
        titleBar.ButtonInactiveForegroundColor = Muted;
        titleBar.ButtonHoverBackgroundColor = Hover;
        titleBar.ButtonHoverForegroundColor = Ink;
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

        WindowPlacementKeeper.Remember(_handle, _session.Directory);
        _bridge.Dispose();
        _store.Release(_session);
    }
}

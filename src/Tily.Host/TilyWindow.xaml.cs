using Tily.Core.Appearance;
using Tily.Core.Native;
using Tily.Host.Bridge;
using Microsoft.UI;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.Web.WebView2.Core;
using Windows.Graphics;
using Windows.UI;

namespace Tily.Host;

public sealed partial class TilyWindow : Window
{
    private const string VirtualHost = "tily.example";
    private const string AmbianceMediaHost = "tily.ambiance";
    private const string DevServerVariable = "TILY_WEB_DEV_URL";
    private const int CursorGripHeight = 16;
    private readonly HostServices _services;
    private readonly WindowRole _role;
    private static readonly string StartUrl = ResolveStartUrl();
    private bool _closeConfirmed;

    public TilyWindow(HostServices services, WindowRole role, DetachedPlacementModel? placement)
    {
        InitializeComponent();
        _services = services;
        _role = role;
        if (placement is null)
        {
            Maximize(new SizeInt32(1480, 900));
        }
        else
        {
            Place(placement);
        }

        AppWindow.SetIcon(Path.Combine(AppContext.BaseDirectory, "Assets", "Tily.ico"));
        var handle = WinRT.Interop.WindowNative.GetWindowHandle(this);
        Bridge = new HostBridge(services, role, DispatcherQueue, handle, ForceClose, ActivateWindow, SetTitle, BrowserLayer, FocusInterface, ApplyWindowColors);
        View.AllowDrop = true;
        Closed += HandleClosed;
        Activated += HandleActivated;
        _ = InitializeWebViewAsync();
    }

    public HostBridge Bridge { get; }

    private void Maximize(SizeInt32 restoredSize)
    {
        AppWindow.Resize(restoredSize);
        if (AppWindow.Presenter is OverlappedPresenter presenter)
        {
            presenter.Maximize();
        }
    }

    private void Place(DetachedPlacementModel placement)
    {
        if (placement.Cursor is { } cursor)
        {
            PlaceAtCursor(cursor);
        }
        else
        {
            PlaceBeside(placement.SourceWindow);
        }
    }

    private void PlaceAtCursor(WindowApi.ScreenPoint cursor)
    {
        var area = DisplayArea.GetFromPoint(new PointInt32(cursor.X, cursor.Y), DisplayAreaFallback.Nearest).WorkArea;
        var width = area.Width * 3 / 5;
        var height = area.Height * 7 / 10;
        var x = Math.Clamp(cursor.X - width / 2, area.X, area.X + area.Width - width);
        var y = Math.Clamp(cursor.Y - CursorGripHeight, area.Y, area.Y + area.Height - height);
        AppWindow.MoveAndResize(new RectInt32(x, y, width, height));
    }

    private void PlaceBeside(nint sourceWindow)
    {
        var source = DisplayArea.GetFromWindowId(Win32Interop.GetWindowIdFromWindow(sourceWindow), DisplayAreaFallback.Nearest);
        var other = OtherDisplay(source);
        var work = (other ?? source).WorkArea;
        var width = work.Width * 7 / 10;
        var height = work.Height * 7 / 10;
        AppWindow.MoveAndResize(new RectInt32(work.X + (work.Width - width) / 2, work.Y + (work.Height - height) / 2, width, height));
        if (other is not null && AppWindow.Presenter is OverlappedPresenter presenter)
        {
            presenter.Maximize();
        }
    }

    private static DisplayArea? OtherDisplay(DisplayArea source)
    {
        var displays = DisplayArea.FindAll();
        for (var index = 0; index < displays.Count; index++)
        {
            if (displays[index].DisplayId.Value != source.DisplayId.Value)
            {
                return displays[index];
            }
        }

        return null;
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
        var media = new AmbianceMedia(_services.DataDirectory);
        Directory.CreateDirectory(media.Folder);
        core.SetVirtualHostNameToFolderMapping(AmbianceMediaHost, media.Folder, CoreWebView2HostResourceAccessKind.Allow);
        Bridge.Attach(core);
        core.Navigate(StartUrl);
        View.Focus(FocusState.Programmatic);
    }

    private void SetTitle(string title) => Title = title;

    private void FocusInterface() => View.Focus(FocusState.Programmatic);

    private void ActivateWindow()
    {
        var handle = WinRT.Interop.WindowNative.GetWindowHandle(this);
        if (WindowApi.IsIconic(handle))
        {
            WindowApi.ShowWindow(handle, WindowApi.ShowRestore);
        }

        Activate();
        WindowApi.SetForegroundWindow(handle);
    }

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

    internal static Color ColorOf(string hex)
    {
        var (red, green, blue) = HexColor.Channels(hex);
        return Color.FromArgb(255, (byte)red, (byte)green, (byte)blue);
    }

    private static string ResolveStartUrl()
    {
        var devServer = Environment.GetEnvironmentVariable(DevServerVariable);
        return string.IsNullOrWhiteSpace(devServer) ? $"https://{VirtualHost}/index.html" : devServer;
    }

    private void HandleNavigationStarting(CoreWebView2 sender, CoreWebView2NavigationStartingEventArgs args) => args.Cancel = !IsInterfaceUrl(args.Uri);

    private static void HandleNewWindowRequested(CoreWebView2 sender, CoreWebView2NewWindowRequestedEventArgs args) => args.Handled = true;

    internal static bool IsInterfaceUrl(string candidate) => IsSameOrigin(candidate, StartUrl);

    private static bool IsSameOrigin(string candidate, string reference) =>
        Uri.TryCreate(candidate, UriKind.Absolute, out var candidateUri)
        && Uri.TryCreate(reference, UriKind.Absolute, out var referenceUri)
        && Uri.Compare(candidateUri, referenceUri, UriComponents.SchemeAndServer, UriFormat.Unescaped, StringComparison.OrdinalIgnoreCase) == 0;

    private static void HandlePermissionRequested(CoreWebView2 sender, CoreWebView2PermissionRequestedEventArgs args)
    {
        if (args.PermissionKind is CoreWebView2PermissionKind.ClipboardRead or CoreWebView2PermissionKind.LocalFonts)
        {
            args.State = CoreWebView2PermissionState.Allow;
        }
    }

    private void HandleActivated(object sender, WindowActivatedEventArgs args)
    {
        var active = args.WindowActivationState != WindowActivationState.Deactivated;
        Bridge.SetWindowActive(active);
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
        if (!_closeConfirmed && Bridge.RequestClose())
        {
            args.Handled = true;
            return;
        }

        if (_role == WindowRole.Main)
        {
            _services.CloseDetachedWindows();
        }

        Bridge.Dispose();
        if (_role == WindowRole.Main)
        {
            _services.Dispose();
        }
    }
}

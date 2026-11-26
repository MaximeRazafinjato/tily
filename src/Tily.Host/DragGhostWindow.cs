using Tily.Core.Appearance;
using Tily.Core.Native;
using Microsoft.UI.Text;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Windows.Graphics;

namespace Tily.Host;

public sealed class DragGhostWindow : Window
{
    private const int CursorOffset = 18;
    private const int GhostWidth = 300;
    private const int GhostHeight = 58;
    private const double StandardDpi = 96.0;

    private readonly TextBlock _action = new() { FontSize = 11 };
    private readonly TextBlock _label = new() { FontSize = 13, FontWeight = FontWeights.SemiBold, TextTrimming = TextTrimming.CharacterEllipsis };
    private readonly Border _frame;
    private bool _shown;

    public DragGhostWindow()
    {
        var panel = new StackPanel { Spacing = 2, Padding = new Thickness(12, 8, 12, 8) };
        panel.Children.Add(_action);
        panel.Children.Add(_label);
        _frame = new Border { Child = panel, BorderThickness = new Thickness(1) };
        Content = _frame;
        var presenter = OverlappedPresenter.Create();
        presenter.IsAlwaysOnTop = true;
        presenter.IsResizable = false;
        presenter.IsMaximizable = false;
        presenter.IsMinimizable = false;
        presenter.SetBorderAndTitleBar(false, false);
        AppWindow.SetPresenter(presenter);
        AppWindow.IsShownInSwitchers = false;
    }

    public void ShowAt(WindowApi.ScreenPoint cursor, string action, string label, WindowColorsModel? colors)
    {
        _action.Text = action;
        _label.Text = label;
        if (colors is not null)
        {
            ApplyColors(colors);
        }

        var scale = Math.Max(1u, WindowApi.GetDpiForWindow(WinRT.Interop.WindowNative.GetWindowHandle(this))) / StandardDpi;
        AppWindow.MoveAndResize(new RectInt32(cursor.X + CursorOffset, cursor.Y + CursorOffset, (int)(GhostWidth * scale), (int)(GhostHeight * scale)));
        if (!_shown)
        {
            AppWindow.Show(false);
            _shown = true;
        }
    }

    public void HideGhost()
    {
        if (_shown)
        {
            AppWindow.Hide();
            _shown = false;
        }
    }

    private void ApplyColors(WindowColorsModel colors)
    {
        _frame.Background = new SolidColorBrush(TilyWindow.ColorOf(colors.Background));
        _frame.BorderBrush = new SolidColorBrush(TilyWindow.ColorOf(colors.HoverBackground));
        _label.Foreground = new SolidColorBrush(TilyWindow.ColorOf(colors.Foreground));
        _action.Foreground = new SolidColorBrush(TilyWindow.ColorOf(colors.InactiveForeground));
    }
}

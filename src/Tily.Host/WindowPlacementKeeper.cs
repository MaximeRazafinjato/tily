using System.Runtime.InteropServices;
using Tily.Core.Native;
using Tily.Core.Session;

namespace Tily.Host;

internal static class WindowPlacementKeeper
{
    public static WindowPlacementModel? Restore(nint windowHandle, string sessionDirectory)
    {
        var placement = new WindowPlacementRepository(sessionDirectory).Load();
        if (placement is null)
        {
            return null;
        }

        var native = new WindowApi.WindowPlacement
        {
            Length = (uint)Marshal.SizeOf<WindowApi.WindowPlacement>(),
            ShowCommand = WindowApi.ShowHide,
            NormalPosition = new WindowApi.NativeRect { Left = placement.Left, Top = placement.Top, Right = placement.Right, Bottom = placement.Bottom }
        };
        return WindowApi.SetWindowPlacement(windowHandle, ref native) ? placement : null;
    }

    public static void Remember(nint windowHandle, string sessionDirectory)
    {
        var native = new WindowApi.WindowPlacement { Length = (uint)Marshal.SizeOf<WindowApi.WindowPlacement>() };
        if (!WindowApi.GetWindowPlacement(windowHandle, ref native))
        {
            return;
        }

        var maximized = native.ShowCommand == WindowApi.ShowMaximized
            || (native.ShowCommand == WindowApi.ShowMinimized && (native.Flags & WindowApi.PlacementRestoreToMaximized) != 0);
        var rect = native.NormalPosition;
        try
        {
            new WindowPlacementRepository(sessionDirectory).Save(new WindowPlacementModel(rect.Left, rect.Top, rect.Right, rect.Bottom, maximized));
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
        }
    }
}

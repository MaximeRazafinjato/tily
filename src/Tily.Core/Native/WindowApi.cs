using System.Runtime.InteropServices;

namespace Tily.Core.Native;

public static class WindowApi
{
    public const uint FlashTray = 0x00000002;
    public const uint FlashTimerNoForeground = 0x0000000C;

    [StructLayout(LayoutKind.Sequential)]
    public struct FlashInfo
    {
        public uint Size;
        public nint WindowHandle;
        public uint Flags;
        public uint Count;
        public uint Timeout;
    }

    [DllImport("user32.dll")]
    public static extern bool FlashWindowEx(ref FlashInfo info);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(nint windowHandle);

    public const int ShowHide = 0;
    public const int ShowMinimized = 2;
    public const int ShowMaximized = 3;
    public const uint PlacementRestoreToMaximized = 0x0002;

    [StructLayout(LayoutKind.Sequential)]
    public struct NativePoint
    {
        public int X;
        public int Y;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct NativeRect
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct WindowPlacement
    {
        public uint Length;
        public uint Flags;
        public uint ShowCommand;
        public NativePoint MinPosition;
        public NativePoint MaxPosition;
        public NativeRect NormalPosition;
    }

    [DllImport("user32.dll")]
    public static extern bool GetWindowPlacement(nint windowHandle, ref WindowPlacement placement);

    [DllImport("user32.dll")]
    public static extern bool SetWindowPlacement(nint windowHandle, ref WindowPlacement placement);

    public const int ShowRestore = 9;

    [DllImport("user32.dll")]
    public static extern bool IsIconic(nint windowHandle);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(nint windowHandle, int command);

    public const uint SoundAsync = 0x0001;
    public const uint SoundNoDefault = 0x0002;
    public const uint SoundAlias = 0x00010000;
    public const uint SoundFileName = 0x00020000;

    [DllImport("winmm.dll", CharSet = CharSet.Unicode)]
    public static extern bool PlaySound(string? sound, nint module, uint flags);
}

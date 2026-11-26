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

    public const int ShowRestore = 9;

    [DllImport("user32.dll")]
    public static extern bool IsIconic(nint windowHandle);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(nint windowHandle, int command);

    public const uint AncestorRoot = 2;

    [StructLayout(LayoutKind.Sequential)]
    public struct ScreenPoint
    {
        public int X;
        public int Y;
    }

    [DllImport("user32.dll")]
    public static extern bool GetCursorPos(out ScreenPoint point);

    [DllImport("user32.dll")]
    public static extern nint WindowFromPoint(ScreenPoint point);

    [DllImport("user32.dll")]
    public static extern nint GetAncestor(nint windowHandle, uint flags);

    [DllImport("user32.dll")]
    public static extern bool ScreenToClient(nint windowHandle, ref ScreenPoint point);

    [DllImport("user32.dll")]
    public static extern uint GetDpiForWindow(nint windowHandle);

    public const uint SoundAsync = 0x0001;
    public const uint SoundNoDefault = 0x0002;
    public const uint SoundAlias = 0x00010000;
    public const uint SoundFileName = 0x00020000;

    [DllImport("winmm.dll", CharSet = CharSet.Unicode)]
    public static extern bool PlaySound(string? sound, nint module, uint flags);
}

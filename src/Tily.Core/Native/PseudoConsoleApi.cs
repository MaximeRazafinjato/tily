using System.Runtime.InteropServices;

namespace Tily.Core.Native;

[StructLayout(LayoutKind.Sequential)]
public struct Coord
{
    public short X;
    public short Y;
}

public static class PseudoConsoleApi
{
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern int CreatePseudoConsole(Coord size, IntPtr hInput, IntPtr hOutput, uint dwFlags, out IntPtr phPC);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern int ResizePseudoConsole(IntPtr hPC, Coord size);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern void ClosePseudoConsole(IntPtr hPC);
}

using System.ComponentModel;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using Tily.Core.Native;

namespace Tily.Core.Terminal;

public sealed class PseudoConsole : IDisposable
{
    private IntPtr _handle;

    public AnonymousPipeServerStream Input { get; }
    public AnonymousPipeServerStream Output { get; }
    public IntPtr Handle => _handle;

    public PseudoConsole(int columns, int rows)
    {
        Input = new AnonymousPipeServerStream(PipeDirection.Out, HandleInheritability.None);
        Output = new AnonymousPipeServerStream(PipeDirection.In, HandleInheritability.None);

        var size = new Coord { X = (short)columns, Y = (short)rows };
        var result = PseudoConsoleApi.CreatePseudoConsole(size, Input.ClientSafePipeHandle.DangerousGetHandle(), Output.ClientSafePipeHandle.DangerousGetHandle(), 0, out _handle);
        if (result != 0)
        {
            throw new Win32Exception(result, $"Création de la pseudo-console impossible (HRESULT 0x{result:X8}).");
        }

        Input.DisposeLocalCopyOfClientHandle();
        Output.DisposeLocalCopyOfClientHandle();
    }

    public void Resize(int columns, int rows)
    {
        var result = PseudoConsoleApi.ResizePseudoConsole(_handle, new Coord { X = (short)columns, Y = (short)rows });
        if (result != 0)
        {
            throw new Win32Exception(result, $"Redimensionnement de la pseudo-console impossible (HRESULT 0x{result:X8}).");
        }
    }

    public void Close()
    {
        if (_handle == IntPtr.Zero)
        {
            return;
        }

        PseudoConsoleApi.ClosePseudoConsole(_handle);
        _handle = IntPtr.Zero;
    }

    public void Dispose()
    {
        Close();
        Input.Dispose();
        Output.Dispose();
    }
}

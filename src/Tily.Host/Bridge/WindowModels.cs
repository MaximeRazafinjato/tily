using Tily.Core.Native;

namespace Tily.Host.Bridge;

public enum WindowRole
{
    Main,
    Detached
}

public sealed record DetachedPlacementModel(WindowApi.ScreenPoint? Cursor, nint SourceWindow);

public sealed record ClientPointModel(double X, double Y);

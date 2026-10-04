namespace Tily.Core.Browser;

public enum BrowserViewport
{
    Desktop,
    Mobile
}

public sealed record BrowserViewportSizeModel(int Width, int Height, double Scale, bool Mobile);

public static class BrowserViewports
{
    public const string Desktop = "desktop";
    public const string Mobile = "mobile";
    public const int MobilePaneWidth = 390;
    public static readonly BrowserViewportSizeModel DesktopCapture = new(1440, 900, 1, false);
    public static readonly BrowserViewportSizeModel MobileCapture = new(MobilePaneWidth, 844, 2, true);

    public static BrowserViewport Parse(string? value) => value?.Trim().ToLowerInvariant() switch
    {
        null or "" or Desktop => BrowserViewport.Desktop,
        Mobile => BrowserViewport.Mobile,
        _ => throw new InvalidOperationException($"Largeur inconnue : « {value} ». Choisissez desktop ou mobile.")
    };

    public static string Name(BrowserViewport viewport) => viewport == BrowserViewport.Mobile ? Mobile : Desktop;

    public static BrowserViewportSizeModel Capture(BrowserViewport viewport) => viewport == BrowserViewport.Mobile ? MobileCapture : DesktopCapture;
}

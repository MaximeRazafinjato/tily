using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Tily.Core.Browser;

namespace Tily.Host.Bridge;

internal static class BrowserDevTools
{
    private const string SettleScript = "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 150))))";

    public static async Task EnableAsync(CoreWebView2 core)
    {
        await core.CallDevToolsProtocolMethodAsync("Runtime.enable", "{}");
        await core.CallDevToolsProtocolMethodAsync("Log.enable", "{}");
        await core.CallDevToolsProtocolMethodAsync("Network.enable", "{}");
    }

    public static async Task EmulateAsync(CoreWebView2 core, BrowserViewportSizeModel size) =>
        await core.CallDevToolsProtocolMethodAsync("Emulation.setDeviceMetricsOverride", Json(new { width = size.Width, height = size.Height, deviceScaleFactor = size.Scale, mobile = size.Mobile }));

    public static async Task ApplyPaneViewportAsync(CoreWebView2 core, BrowserViewport viewport)
    {
        if (viewport == BrowserViewport.Mobile)
        {
            await core.CallDevToolsProtocolMethodAsync("Emulation.setDeviceMetricsOverride", Json(new { width = 0, height = 0, deviceScaleFactor = 0, mobile = true }));
        }
        else
        {
            await core.CallDevToolsProtocolMethodAsync("Emulation.clearDeviceMetricsOverride", "{}");
        }
    }

    public static async Task SettleAsync(CoreWebView2 core) =>
        await core.CallDevToolsProtocolMethodAsync("Runtime.evaluate", Json(new { expression = SettleScript, awaitPromise = true }));

    public static async Task<(int Width, int Height)> ContentSizeAsync(CoreWebView2 core)
    {
        using var metrics = JsonDocument.Parse(await core.CallDevToolsProtocolMethodAsync("Page.getLayoutMetrics", "{}"));
        var content = metrics.RootElement.GetProperty("cssContentSize");
        var width = (int)Math.Ceiling(content.GetProperty("width").GetDouble());
        var height = (int)Math.Min(Math.Ceiling(content.GetProperty("height").GetDouble()), BrowserCaptureModel.MaxFullPageHeight);
        return (width, height);
    }

    public static async Task<string> ScreenshotAsync(CoreWebView2 core, int width, int height, bool fullPage)
    {
        var parameters = fullPage
            ? Json(new { format = "png", captureBeyondViewport = true, clip = new { x = 0, y = 0, width, height, scale = 1 } })
            : Json(new { format = "png" });
        using var result = JsonDocument.Parse(await core.CallDevToolsProtocolMethodAsync("Page.captureScreenshot", parameters));
        return result.RootElement.GetProperty("data").GetString() ?? string.Empty;
    }

    public static async Task<string> PreviewAsync(CoreWebView2 core)
    {
        using var stream = new Windows.Storage.Streams.InMemoryRandomAccessStream();
        await core.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Jpeg, stream);
        var bytes = new byte[stream.Size];
        using var input = stream.GetInputStreamAt(0).AsStreamForRead();
        await input.ReadExactlyAsync(bytes);
        return $"data:image/jpeg;base64,{Convert.ToBase64String(bytes)}";
    }

    public static async Task<string?> ResponseBodyAsync(CoreWebView2 core, string requestId) =>
        DevToolsNetwork.BodyOf(await core.CallDevToolsProtocolMethodAsync("Network.getResponseBody", Json(new { requestId })));

    private static string Json(object value) => JsonSerializer.Serialize(value);
}

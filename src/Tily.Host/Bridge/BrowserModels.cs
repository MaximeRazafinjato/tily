using System.Text.Json;

namespace Tily.Host.Bridge;

internal sealed record BrowserNavigationModel(string Url, string Title, bool Success, int? Status, string? Error, int Errors);

internal sealed record BrowserStateModel(string Pane, string Url, string Title, bool Loading, bool CanGoBack, bool CanGoForward, int Errors, string Viewport);

internal sealed record BrowserCaptureModel(string Png, int Width, int Height, double Scale, string Viewport, string Url, string Title)
{
    public const double MaxFullPageHeight = 16000;
}

internal sealed class BrowserNavigationWaiter
{
    public TaskCompletionSource<BrowserNavigationModel> Completion { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);

    public ulong? NavigationId { get; set; }
}

internal sealed record BrowserCallbacks(Action<BrowserView> StateChanged, Action<BrowserView, string> NewPane, Action<BrowserView, JsonElement> Key, Action<BrowserView> Focused);

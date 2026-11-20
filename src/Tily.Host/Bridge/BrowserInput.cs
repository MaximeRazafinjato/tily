using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Web.WebView2.Core;
using Tily.Core.Browser;

namespace Tily.Host.Bridge;

internal static class BrowserInput
{
    private const string LeftButton = "left";
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web) { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };

    public static async Task<T> PageAsync<T>(CoreWebView2 core, string script) => BrowserPageResults.Parse<T>(await EvaluateAsync(core, script));

    public static async Task<JsonElement> PageValueAsync(CoreWebView2 core, string script) => BrowserPageResults.Value(await EvaluateAsync(core, script));

    public static async Task<string> EvaluateAsync(CoreWebView2 core, string expression, bool repl = false) =>
        await core.CallDevToolsProtocolMethodAsync("Runtime.evaluate", Json(new { expression, awaitPromise = true, returnByValue = true, replMode = repl ? true : (bool?)null, userGesture = true }));

    public static async Task ClickAsync(CoreWebView2 core, double x, double y, bool doubleClick)
    {
        await MouseAsync(core, new { type = "mouseMoved", x, y });
        for (var count = 1; count <= (doubleClick ? 2 : 1); count++)
        {
            await MouseAsync(core, new { type = "mousePressed", x, y, button = LeftButton, buttons = 1, clickCount = count });
            await MouseAsync(core, new { type = "mouseReleased", x, y, button = LeftButton, buttons = 0, clickCount = count });
        }
    }

    public static async Task WheelAsync(CoreWebView2 core, double x, double y, double deltaX, double deltaY)
    {
        await MouseAsync(core, new { type = "mouseMoved", x, y });
        await MouseAsync(core, new { type = "mouseWheel", x, y, deltaX, deltaY });
    }

    public static async Task InsertTextAsync(CoreWebView2 core, string text) =>
        await core.CallDevToolsProtocolMethodAsync("Input.insertText", Json(new { text }));

    public static async Task PressAsync(CoreWebView2 core, BrowserKeyChordModel chord)
    {
        await core.ExecuteScriptAsync(BrowserPageDriver.Driving(true));
        try
        {
            var modifiers = BrowserKeyModifiers.None;
            foreach (var modifier in chord.ModifierKeys)
            {
                modifiers |= modifier.Modifier;
                await KeyAsync(core, "rawKeyDown", modifier.Key, modifiers, null);
            }

            await KeyAsync(core, chord.Key.Text is null ? "rawKeyDown" : "keyDown", chord.Key, modifiers, chord.Key.Text);
            await KeyAsync(core, "keyUp", chord.Key, modifiers, null);
            foreach (var modifier in chord.ModifierKeys.Reverse())
            {
                modifiers &= ~modifier.Modifier;
                await KeyAsync(core, "keyUp", modifier.Key, modifiers, null);
            }
        }
        finally
        {
            try
            {
                await core.ExecuteScriptAsync(BrowserPageDriver.Driving(false));
            }
            catch (Exception exception) when (exception is COMException or InvalidOperationException)
            {
            }
        }
    }

    private static async Task KeyAsync(CoreWebView2 core, string type, BrowserKeyModel key, BrowserKeyModifiers modifiers, string? text) =>
        await core.CallDevToolsProtocolMethodAsync("Input.dispatchKeyEvent", Json(new
        {
            type,
            modifiers = (int)modifiers,
            key = key.Key,
            code = key.Code,
            windowsVirtualKeyCode = key.KeyCode,
            nativeVirtualKeyCode = key.KeyCode,
            text,
            unmodifiedText = text
        }));

    private static async Task MouseAsync(CoreWebView2 core, object parameters) =>
        await core.CallDevToolsProtocolMethodAsync("Input.dispatchMouseEvent", Json(parameters));

    private static string Json(object value) => JsonSerializer.Serialize(value, Options);
}

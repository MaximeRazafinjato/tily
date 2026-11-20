using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;
using Tily.Core.Browser;
using Tily.Core.Mcp;

namespace Tily.Host.Bridge;

internal static class BrowserDriver
{
    private const double ScrollShare = 0.8;
    private static readonly TimeSpan NavigationTimeout = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan EvaluationTimeout = TimeSpan.FromSeconds(30);
    private static readonly BrowserKeyChordModel Enter = BrowserKeys.Parse("Enter");
    private static readonly BrowserKeyChordModel Delete = BrowserKeys.Parse("Delete");

    public static Task<JsonElement> SnapshotAsync(BrowserView view, string? scope) =>
        view.DriveAsync(null, core => BrowserInput.PageValueAsync(core, BrowserPageDriver.Snapshot(scope)));

    public static Task<BrowserActionModel> ClickAsync(BrowserView view, BrowserTargetModel target, bool doubleClick) =>
        view.DriveAsync(EmulationOf(view, target), async core =>
        {
            var point = await BrowserInput.PageAsync<BrowserPointModel>(core, BrowserPageDriver.Point(target));
            var navigation = await view.FollowAsync(() => BrowserInput.ClickAsync(core, point.X, point.Y, doubleClick), NavigationTimeout);
            return await ActionAsync(view, core, point.Description, point.Matches, navigation);
        });

    public static Task<BrowserActionModel> TypeAsync(BrowserView view, BrowserTargetModel? target, string text, bool clear, bool submit) =>
        view.DriveAsync(EmulationOf(view, target), async core =>
        {
            await ClickPointAsync(core, target);
            var field = await BrowserInput.PageAsync<BrowserFieldModel>(core, BrowserPageDriver.Field(target is { IsPoint: false } ? target : null, text, clear));
            if (!field.Handled && text.Length > 0)
            {
                await BrowserInput.InsertTextAsync(core, text);
            }
            else if (!field.Handled && clear)
            {
                await BrowserInput.PressAsync(core, Delete);
            }

            var value = await BrowserInput.PageAsync<BrowserValueModel>(core, BrowserPageDriver.Read(field.Ref));
            var navigation = submit ? await view.FollowAsync(() => BrowserInput.PressAsync(core, Enter), NavigationTimeout) : null;
            return (await ActionAsync(view, core, field.Description, 1, navigation)) with { Value = value.Value };
        });

    public static Task<BrowserActionModel> PressAsync(BrowserView view, BrowserTargetModel? target, string keys, int repeat) =>
        view.DriveAsync(EmulationOf(view, target), async core =>
        {
            var chord = BrowserKeys.Parse(keys);
            var description = await ClickPointAsync(core, target);
            if (target is { IsPoint: false })
            {
                description = (await BrowserInput.PageAsync<BrowserFieldModel>(core, BrowserPageDriver.Focus(target))).Description;
            }

            var navigation = await view.FollowAsync(async () =>
            {
                for (var count = 0; count < McpBrowser.Repeat(repeat); count++)
                {
                    await BrowserInput.PressAsync(core, chord);
                }
            }, NavigationTimeout);
            return await ActionAsync(view, core, description ?? keys, 1, navigation);
        });

    public static Task<JsonNode> ScrollAsync(BrowserView view, BrowserTargetModel? target, string? direction, double? amount) =>
        view.DriveAsync(EmulationOf(view, target), async core =>
        {
            if (direction is null)
            {
                var revealed = await BrowserInput.PageValueAsync(core, BrowserPageDriver.Reveal(BrowserTargets.Required(target)));
                return JsonNode.Parse(revealed.GetRawText())!;
            }

            var point = await BrowserInput.PageAsync<BrowserPointModel>(core, target is null ? BrowserPageDriver.Center() : BrowserPageDriver.Point(target, reachable: false));
            var box = await BrowserInput.PageAsync<BrowserBoxModel>(core, BrowserPageDriver.ScrollStart(point.X, point.Y));
            var (deltaX, deltaY) = Delta(direction, amount, box);
            await BrowserInput.WheelAsync(core, point.X, point.Y, deltaX, deltaY);
            var result = JsonNode.Parse((await BrowserInput.PageValueAsync(core, BrowserPageDriver.ScrollEnd())).GetRawText())!;
            result["target"] = point.Description;
            return result;
        });

    public static Task<BrowserEvaluationModel> EvaluateAsync(BrowserView view, string expression) =>
        view.DriveAsync(null, async core =>
        {
            try
            {
                return BrowserPageResults.Evaluation(await BrowserInput.EvaluateAsync(core, expression, repl: true).WaitAsync(EvaluationTimeout));
            }
            catch (TimeoutException)
            {
                throw new InvalidOperationException($"L’expression n’a pas rendu de résultat en {EvaluationTimeout.TotalSeconds:0} s.");
            }
        });

    private static BrowserViewportSizeModel? EmulationOf(BrowserView view, BrowserTargetModel? target) => target is { IsPoint: true } ? BrowserViewports.Capture(view.Viewport) : null;

    private static async Task<string?> ClickPointAsync(CoreWebView2 core, BrowserTargetModel? target)
    {
        if (target is not { IsPoint: true })
        {
            return null;
        }

        var point = await BrowserInput.PageAsync<BrowserPointModel>(core, BrowserPageDriver.Point(target));
        await BrowserInput.ClickAsync(core, point.X, point.Y, false);
        return point.Description;
    }

    private static (double X, double Y) Delta(string direction, double? amount, BrowserBoxModel box) => direction switch
    {
        BrowserScroll.Up => (0, -(amount ?? box.Height * ScrollShare)),
        BrowserScroll.Down => (0, amount ?? box.Height * ScrollShare),
        BrowserScroll.Left => (-(amount ?? box.Width * ScrollShare), 0),
        BrowserScroll.Right => (amount ?? box.Width * ScrollShare, 0),
        _ => throw new InvalidOperationException(BrowserScroll.Unknown(direction))
    };

    private static async Task<string?> FocusedAsync(CoreWebView2 core)
    {
        try
        {
            return (await BrowserInput.PageAsync<BrowserFocusedModel>(core, BrowserPageDriver.Focused())).Focused;
        }
        catch (Exception exception) when (exception is InvalidOperationException or COMException or ArgumentException or JsonException)
        {
            return null;
        }
    }

    private static async Task<BrowserActionModel> ActionAsync(BrowserView view, CoreWebView2 core, string target, int matches, BrowserNavigationModel? navigation)
    {
        var focused = navigation is null ? await FocusedAsync(core) : null;
        var state = view.State();
        return new BrowserActionModel(target, matches > 1 ? matches : null, state.Url, state.Title, state.Errors, navigation, null, focused);
    }
}

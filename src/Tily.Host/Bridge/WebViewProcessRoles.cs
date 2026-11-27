using Microsoft.Web.WebView2.Core;
using Tily.Core.Activity;

namespace Tily.Host.Bridge;

internal static class WebViewProcessRoles
{
    public static async Task<IReadOnlyDictionary<int, string>> ReadAsync(CoreWebView2Environment environment)
    {
        var roles = new Dictionary<int, string>();
        foreach (var process in await environment.GetProcessExtendedInfosAsync())
        {
            var frames = process.AssociatedFrameInfos;
            if (process.ProcessInfo.Kind == CoreWebView2ProcessKind.Renderer && frames.Count > 0)
            {
                roles[process.ProcessInfo.ProcessId] = frames.Any(frame => TilyWindow.IsInterfaceUrl(frame.Source)) ? ProcessCategory.Interface : ProcessCategory.BrowserPages;
            }
        }

        return roles;
    }
}

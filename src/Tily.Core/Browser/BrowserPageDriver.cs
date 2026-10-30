using System.Text.Json;
using System.Text.Json.Serialization;

namespace Tily.Core.Browser;

public static class BrowserPageDriver
{
    public const string DrivingFlag = "__tilyDriving";

    private static readonly JsonSerializerOptions ArgumentOptions = new(JsonSerializerDefaults.Web) { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };

    private const string Library = $$"""
        () => {
          if (window.__tilyDriver) {
            return window.__tilyDriver;
          }
          {{BrowserPageElements.Script}}
          {{BrowserPageActions.Script}}
          const driver = { snapshot, point, field, focus, read, focused, scrollStart, scrollEnd, reveal, center, Refusal };
          Object.defineProperty(window, '__tilyDriver', { value: driver, configurable: true });
          return driver;
        }
        """;

    public static string Snapshot(string? scope) => Call("snapshot", new { scope });

    public static string Point(BrowserTargetModel target, bool reachable = true) =>
        Call("point", new { @ref = target.Ref, target.Selector, target.Text, target.X, target.Y, reachable });

    public static string Center() => Call("center", new { });

    public static string Field(BrowserTargetModel? target, string value, bool clear) => Call("field", new { target, value, clear });

    public static string Focus(BrowserTargetModel target) => Call("focus", new { target });

    public static string Read(string reference) => Call("read", new { @ref = reference });

    public static string Focused() => Call("focused", new { });

    public static string ScrollStart(double x, double y) => Call("scrollStart", new { x, y });

    public static string ScrollEnd() => Call("scrollEnd", new { });

    public static string Reveal(BrowserTargetModel target) => Call("reveal", new { target });

    public static string Driving(bool driving) => $"window.{DrivingFlag} = {(driving ? "true" : "false")}";

    private static string Call(string method, object arguments) => $$"""
        (async () => {
          const driver = ({{Library}})();
          try {
            return await driver.{{method}}({{JsonSerializer.Serialize(arguments, ArgumentOptions)}});
          } catch (error) {
            return { error: error instanceof driver.Refusal ? error.message : `Le script de Tily a échoué dans la page : ${error && error.message}` };
          }
        })()
        """;
}

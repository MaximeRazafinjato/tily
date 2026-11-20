using Tily.Core.Browser;

namespace Tily.Core.Mcp;

public static class McpBrowser
{
    public const string Open = "browserOpen";
    public const string Navigate = "browserNavigate";
    public const string Reload = "browserReload";
    public const string Resize = "browserResize";
    public const string Console = "browserConsole";
    public const string Network = "browserNetwork";
    public const string Screenshot = "browserScreenshot";
    public const string Snapshot = "browserSnapshot";
    public const string Click = "browserClick";
    public const string Type = "browserType";
    public const string Press = "browserPress";
    public const string Scroll = "browserScroll";
    public const string Evaluate = "browserEvaluate";
    public const int MaxRepeat = 100;
    public const int DefaultLimit = 50;
    public const int MaxLimit = 500;
    public static readonly TimeSpan AnswerTimeout = TimeSpan.FromSeconds(60);
    private static readonly string[] Placements = ["right", "down", "tab"];
    private static readonly string[] Levels = ["debug", "log", "warn", "error"];
    private const string PngExtension = ".png";

    public static bool IsLong(string tool) => tool is Open or Navigate or Reload or Resize or Screenshot or Snapshot or Click or Type or Press or Scroll or Evaluate;

    public static int Repeat(int requested) => Math.Clamp(requested, 1, MaxRepeat);

    public static string Keys(string? keys)
    {
        BrowserKeys.Parse(keys);
        return keys!.Trim();
    }

    public static string Expression(string? expression) =>
        string.IsNullOrWhiteSpace(expression) ? throw new InvalidOperationException("Indiquez l’expression JavaScript à évaluer dans la page.") : expression;

    public static double? Amount(double? amount) =>
        amount is null or > 0 ? amount : throw new InvalidOperationException("La distance de défilement doit être positive, en pixels.");

    public static string TypedText(string? text, bool clear) =>
        text is { Length: > 0 } || clear ? text ?? string.Empty : throw new InvalidOperationException("Indiquez le texte à saisir, ou clear pour vider le champ.");

    public static int Limit(int requested) => Math.Clamp(requested, 1, MaxLimit);

    public static string? Url(string? url) => string.IsNullOrWhiteSpace(url) ? null : BrowserAddress.Normalize(url);

    public static string Placement(string? placement)
    {
        var value = string.IsNullOrWhiteSpace(placement) ? Placements[0] : placement.Trim().ToLowerInvariant();
        return Placements.Contains(value) ? value : throw new InvalidOperationException($"Emplacement inconnu : « {placement} ». Choisissez right (côte à côte), down (en dessous) ou tab (nouvel onglet).");
    }

    public static string? Viewport(string? viewport) => string.IsNullOrWhiteSpace(viewport) ? null : BrowserViewports.Name(BrowserViewports.Parse(viewport));

    public static string Level(string? level)
    {
        var value = string.IsNullOrWhiteSpace(level) ? Levels[1] : level.Trim().ToLowerInvariant();
        return Levels.Contains(value) ? value : throw new InvalidOperationException($"Niveau inconnu : « {level} ». Choisissez debug, log, warn ou error.");
    }

    public static string? ScreenshotPath(string? path, string currentDirectory)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return null;
        }

        var full = Path.GetFullPath(path.Trim(), currentDirectory);
        if (!full.EndsWith(PngExtension, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"La capture s’enregistre en PNG : le chemin doit finir par {PngExtension}.");
        }

        var folder = Path.GetDirectoryName(full);
        return folder is not null && Directory.Exists(folder) ? full : throw new InvalidOperationException($"Dossier introuvable pour la capture : {folder}.");
    }
}

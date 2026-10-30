using System.ComponentModel;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;
using Tily.Core.Browser;
using Tily.Core.Mcp;

namespace Tily.Mcp;

internal static class TilyBrowserInputTools
{
    private const string Target =
        "Sans pane, l’outil vise votre dernier pane navigateur, sinon le seul pane navigateur de votre onglet ou de Tily. "
        + "L’élément se vise d’une seule façon : ref (rendue par tily_browser_snapshot, la plus sûre), selector (CSS, premier élément affiché), "
        + "label (texte visible ou nom accessible, « Se connecter », « Email »), ou x et y (pixels de la page telle que la rend tily_browser_screenshot sans fullPage).";

    private const string SnapshotDescription =
        "Contenu d’un pane navigateur de Tily lu sans capture : titres, textes, champs, boutons et liens, avec rôle, nom, état (checked, disabled, expanded…) et valeur, "
        + "et une référence [ref=e12] pour chaque élément interactif, à passer à tily_browser_click, tily_browser_type, tily_browser_press ou tily_browser_scroll. "
        + "Une référence reste valable jusqu’au prochain chargement de la page. Rend aussi l’élément qui a le focus, la taille de la page affichée et sa position de défilement. "
        + "scope limite la lecture à un sélecteur CSS ; 800 lignes au plus. Sans pane, l’outil vise votre dernier pane navigateur, sinon le seul de votre onglet ou de Tily.";

    private const string ClickDescription =
        "Clique comme la souris (vrai clic, double clic avec doubleClick) sur un élément d’un pane navigateur de Tily, après l’avoir amené à l’écran. "
        + "Refuse un élément masqué ou recouvert (fenêtre modale, bandeau) en nommant ce qui le recouvre. Attend la fin d’une navigation déclenchée (30 s au plus). "
        + "Rend l’élément cliqué, l’adresse, le titre, le nombre d’erreurs et l’élément qui a le focus ; le focus clavier de l’utilisateur ne change pas. " + Target;

    private const string TypeDescription =
        "Saisit du texte comme une frappe dans un champ d’un pane navigateur de Tily (input, textarea, contenu éditable) ; sans élément visé, dans le champ qui a le focus. "
        + "clear remplace le contenu au lieu d’écrire à la fin ; submit presse Entrée ensuite et attend la navigation éventuelle. "
        + "Sur une liste déroulante (select), choisit l’option dont le libellé ou la valeur correspond. Rend la valeur du champ après saisie (masquée pour un mot de passe). " + Target;

    private const string PressDescription =
        "Presse une touche ou une combinaison dans un pane navigateur de Tily : Enter, Escape, Tab, Backspace, Delete, ArrowDown, PageDown, Home, F5, une lettre, "
        + "ou une combinaison comme Ctrl+A ou Shift+Tab ; repeat la répète (100 fois au plus). Avec un élément visé, celui-ci prend d’abord le focus. "
        + "La touche va à la page, même si c’est un raccourci de Tily. Attend la navigation éventuelle et rend l’élément qui a le focus. " + Target;

    private const string ScrollDescription =
        "Fait défiler un pane navigateur de Tily. Avec direction (up, down, left, right), comme la molette, de amount pixels (80 % de la zone par défaut), "
        + "sur l’élément visé ou au centre de la page : la zone défilante sous ce point défile. Sans direction, amène l’élément visé au centre de l’écran. "
        + "Rend la zone défilée, sa position (top, left), son maximum (maxTop, maxLeft) et si elle a bougé. " + Target;

    private const string EvaluateDescription =
        "Évalue une expression JavaScript dans la page d’un pane navigateur de Tily et rend son résultat sérialisé en JSON (20 000 caractères au plus) : "
        + "lecture du DOM, de localStorage ou d’un état calculé, ou action que les autres outils ne couvrent pas. await est accepté au premier niveau et une promesse est attendue "
        + "(30 s au plus) ; une exception rend son message et sa pile. Pour lire et piloter l’interface comme l’utilisateur, préférez tily_browser_snapshot et tily_browser_click. "
        + "Sans pane, l’outil vise votre dernier pane navigateur, sinon le seul de votre onglet ou de Tily.";

    private const string PaneDescription = "Identifiant du pane navigateur, donné par tily_layout.";
    private const string RefDescription = "Référence de l’élément rendue par tily_browser_snapshot, par exemple e12.";
    private const string SelectorDescription = "Sélecteur CSS de l’élément ; le premier élément affiché est visé.";
    private const string LabelDescription = "Texte visible ou nom accessible de l’élément (libellé d’un champ, texte d’un bouton).";
    private const string XDescription = "Abscisse en pixels de la page telle que la rend tily_browser_screenshot, avec y.";
    private const string YDescription = "Ordonnée en pixels de la page telle que la rend tily_browser_screenshot, avec x.";

    public static IEnumerable<McpServerTool> Tools() =>
    [
        McpServerTool.Create((Func<string?, string?, CancellationToken, Task<CallToolResult>>)SnapshotAsync, Options("tily_browser_snapshot", "Lire la page", SnapshotDescription, true, true)),
        McpServerTool.Create((Func<string?, string?, string?, double?, double?, bool, string?, CancellationToken, Task<CallToolResult>>)ClickAsync, Options("tily_browser_click", "Cliquer dans la page", ClickDescription, false, false)),
        McpServerTool.Create((Func<string?, bool, bool, string?, string?, string?, double?, double?, string?, CancellationToken, Task<CallToolResult>>)TypeAsync, Options("tily_browser_type", "Saisir dans la page", TypeDescription, false, false)),
        McpServerTool.Create((Func<string, int, string?, string?, string?, double?, double?, string?, CancellationToken, Task<CallToolResult>>)PressAsync, Options("tily_browser_press", "Presser une touche", PressDescription, false, false)),
        McpServerTool.Create((Func<string?, double?, string?, string?, string?, double?, double?, string?, CancellationToken, Task<CallToolResult>>)ScrollAsync, Options("tily_browser_scroll", "Faire défiler la page", ScrollDescription, false, false)),
        McpServerTool.Create((Func<string, string?, CancellationToken, Task<CallToolResult>>)EvaluateAsync, Options("tily_browser_evaluate", "Évaluer du JavaScript", EvaluateDescription, false, false))
    ];

    private static McpServerToolCreateOptions Options(string name, string title, string description, bool readOnly, bool idempotent) => new()
    {
        Name = name,
        Title = title,
        Description = description,
        ReadOnly = readOnly,
        Idempotent = idempotent,
        Destructive = false,
        OpenWorld = true
    };

    private static Task<CallToolResult> SnapshotAsync(
        [Description("Sélecteur CSS de la partie de la page à lire ; par défaut, toute la page.")] string? scope = null,
        [Description(PaneDescription)] string? pane = null,
        CancellationToken token = default) =>
        TilyConnection.CallAsync(McpBrowser.Snapshot, new { scope = string.IsNullOrWhiteSpace(scope) ? null : scope.Trim(), pane }, token);

    private static Task<CallToolResult> ClickAsync(
        [Description(RefDescription)] string? @ref = null,
        [Description(SelectorDescription)] string? selector = null,
        [Description(LabelDescription)] string? label = null,
        [Description(XDescription)] double? x = null,
        [Description(YDescription)] double? y = null,
        [Description("Double-cliquer au lieu de cliquer.")] bool doubleClick = false,
        [Description(PaneDescription)] string? pane = null,
        CancellationToken token = default) =>
        TilyConnection.CallCheckedAsync(McpBrowser.Click, () => new { target = BrowserTargets.Required(BrowserTargets.Of(@ref, selector, label, x, y)), doubleClick, pane }, token);

    private static Task<CallToolResult> TypeAsync(
        [Description("Texte à saisir ; vide avec clear pour vider le champ.")] string? text = null,
        [Description("Remplacer le contenu du champ au lieu d’écrire à la fin.")] bool clear = false,
        [Description("Presser Entrée après la saisie.")] bool submit = false,
        [Description(RefDescription)] string? @ref = null,
        [Description(SelectorDescription)] string? selector = null,
        [Description(LabelDescription)] string? label = null,
        [Description(XDescription)] double? x = null,
        [Description(YDescription)] double? y = null,
        [Description(PaneDescription)] string? pane = null,
        CancellationToken token = default) =>
        TilyConnection.CallCheckedAsync(McpBrowser.Type, () => new { text = McpBrowser.TypedText(text, clear), clear, submit, target = BrowserTargets.Of(@ref, selector, label, x, y), pane }, token);

    private static Task<CallToolResult> PressAsync(
        [Description("Touche ou combinaison : Enter, Escape, Tab, ArrowDown, Ctrl+A, Shift+Tab…")] string keys,
        [Description("Nombre de fois, de 1 à 100.")] int repeat = 1,
        [Description(RefDescription)] string? @ref = null,
        [Description(SelectorDescription)] string? selector = null,
        [Description(LabelDescription)] string? label = null,
        [Description(XDescription)] double? x = null,
        [Description(YDescription)] double? y = null,
        [Description(PaneDescription)] string? pane = null,
        CancellationToken token = default) =>
        TilyConnection.CallCheckedAsync(McpBrowser.Press, () => new { keys = McpBrowser.Keys(keys), repeat = McpBrowser.Repeat(repeat), target = BrowserTargets.Of(@ref, selector, label, x, y), pane }, token);

    private static Task<CallToolResult> ScrollAsync(
        [Description("up, down, left ou right ; absente : amener l’élément visé à l’écran.")] string? direction = null,
        [Description("Distance en pixels ; par défaut, 80 % de la zone défilée.")] double? amount = null,
        [Description(RefDescription)] string? @ref = null,
        [Description(SelectorDescription)] string? selector = null,
        [Description(LabelDescription)] string? label = null,
        [Description(XDescription)] double? x = null,
        [Description(YDescription)] double? y = null,
        [Description(PaneDescription)] string? pane = null,
        CancellationToken token = default) =>
        TilyConnection.CallCheckedAsync(McpBrowser.Scroll, () =>
        {
            var target = BrowserTargets.Of(@ref, selector, label, x, y);
            var value = BrowserScroll.Direction(direction);
            if (value is null && target is null)
            {
                throw new InvalidOperationException("Indiquez direction (up, down, left ou right), ou l’élément à amener à l’écran.");
            }

            return new { direction = value, amount = McpBrowser.Amount(amount), target, pane };
        }, token);

    private static Task<CallToolResult> EvaluateAsync(
        [Description("Expression JavaScript, par exemple document.querySelectorAll('tr').length ou await fetch('/api/me').then(r => r.json()).")] string expression,
        [Description(PaneDescription)] string? pane = null,
        CancellationToken token = default) =>
        TilyConnection.CallCheckedAsync(McpBrowser.Evaluate, () => new { expression = McpBrowser.Expression(expression), pane }, token);
}

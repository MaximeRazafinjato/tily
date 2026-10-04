using System.ComponentModel;
using System.Diagnostics;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;
using Tily.Core.Mcp;

namespace Tily.Mcp;

internal static class TilyTools
{
    public const string ServerName = "tily";
    private const string HostAssembly = "Tily.dll";
    public static readonly string Version = HostVersion() ?? typeof(TilyTools).Assembly.GetName().Version?.ToString(3) ?? "1.0.0";

    public const string Instructions =
        "Tily est le terminal Windows dans lequel tourne cette session : workspaces, puis onglets, puis panes (splits). "
        + "Ces outils lisent et pilotent la fenêtre de Tily qui a ouvert ce terminal, avec ses workspaces ; les autres fenêtres de Tily ne sont ni visibles ni pilotables. "
        + "Le pane d’où vous êtes lancé est marqué « caller » dans tily_layout. "
        + "Pour une erreur, un log ou la sortie d’un serveur, lisez le pane (tily_read_pane, tily_commands) plutôt que de demander un copier-coller à l’utilisateur ; "
        + "pour attendre qu’un serveur soit prêt ou qu’une commande se termine, utilisez tily_wait_for plutôt qu’un sleep. "
        + "Pour lancer un serveur ou une commande longue, ouvrez-lui un onglet ou un split (tily_new_tab, tily_split avec command) plutôt que de bloquer votre propre terminal. "
        + "Pour vérifier une application web, ouvrez-la dans un pane navigateur de Tily (tily_browser_open) et lisez vous-même sa console, son réseau et ses captures "
        + "(tily_browser_console, tily_browser_network, tily_browser_screenshot) plutôt que de demander à l’utilisateur.";

    private const string LayoutDescription =
        "Disposition complète de votre fenêtre de Tily : workspaces, onglets et panes, avec pour chaque pane son identifiant, son dossier, sa branche Git, son shell, "
        + "l’état de l’agent qui y tourne (Claude Code, Codex) et s’il a déjà démarré. Le pane appelant porte « caller: true », "
        + "le workspace, l’onglet et le pane affichés portent « active: true ». Un pane jamais affiché depuis l’ouverture de la fenêtre n’a pas encore démarré : "
        + "son shell ne tourne pas. Un onglet ou un pane créé par un agent porte « owner » (le pane de cet agent) et, s’il a été créé par vous, « mine: true ».";

    private const string ReadPaneDescription =
        "Texte affiché par un pane de votre fenêtre de Tily, sans séquences d’échappement : ses dernières lignes (100 par défaut), "
        + "ou la sortie complète d’une commande terminée (lastCommand, ou commandId rendu par tily_commands ; Windows PowerShell et PowerShell 7 uniquement). "
        + "Un programme plein écran (vim, Claude Code…) rend l’écran qu’il affiche. "
        + "Un pane jamais affiché depuis l’ouverture de la fenêtre n’a pas démarré et ne peut pas être lu.";

    private const string CommandsDescription =
        "Commandes terminées dans les panes de votre fenêtre de Tily, de la plus récente à la plus ancienne : identifiant, commande, dossier, succès, durée, heure de fin "
        + "et fin de la sortie (20 dernières lignes ; la sortie complète se lit avec tily_read_pane et commandId). "
        + "Sans pane, couvre tous les panes démarrés de tous les workspaces ; failedOnly ne garde que les échecs. Les commandes en cours sont listées à part. "
        + "Seuls Windows PowerShell et PowerShell 7 signalent leurs commandes : les panes des autres shells sont listés dans « untracked », succès inconnu.";

    private const string WaitForDescription =
        "Attend qu’un texte s’affiche dans un pane (pattern, par exemple « ready in » ou « Now listening on »), ou, sans pattern, que la commande en cours se termine. "
        + "Le texte est cherché sans tenir compte de la casse dans la sortie de la commande en cours depuis son lancement ; sans commande en cours, "
        + "dans ce qui s’affiche après l’invite (Windows PowerShell et PowerShell 7) ou dans l’écran visible (autres shells). "
        + "L’attente s’arrête au plus tard après timeoutSeconds, ou dès que la commande suivie se termine sans afficher le texte, "
        + "ou que le shell se ferme ; le résultat dit lequel et rend la fin de l’écran. Préférez cet outil à un sleep.";

    private const string PaneDescription = "Identifiant du pane, donné par tily_layout.";

    public static McpServerPrimitiveCollection<McpServerTool> Collection() =>
    [
        McpServerTool.Create((Func<CancellationToken, Task<CallToolResult>>)LayoutAsync, ReadOnly("tily_layout", "Disposition de la fenêtre de Tily", LayoutDescription)),
        McpServerTool.Create((Func<string, int, bool, int?, CancellationToken, Task<CallToolResult>>)ReadPaneAsync, ReadOnly("tily_read_pane", "Lire un pane", ReadPaneDescription)),
        McpServerTool.Create((Func<string?, bool, int, CancellationToken, Task<CallToolResult>>)CommandsAsync, ReadOnly("tily_commands", "Commandes terminées", CommandsDescription)),
        McpServerTool.Create((Func<string, string?, bool, int, CancellationToken, Task<CallToolResult>>)WaitForAsync, ReadOnly("tily_wait_for", "Attendre dans un pane", WaitForDescription)),
        .. TilyActions.Tools(),
        .. TilyWorktreeTools.Tools(),
        .. TilyBrowserTools.Tools()
    ];

    private static McpServerToolCreateOptions ReadOnly(string name, string title, string description) => new()
    {
        Name = name,
        Title = title,
        Description = description,
        ReadOnly = true,
        Idempotent = true,
        Destructive = false,
        OpenWorld = false
    };

    private static Task<CallToolResult> LayoutAsync(CancellationToken token) =>
        TilyConnection.CallAsync(McpLayout.Tool, null, token);

    private static Task<CallToolResult> ReadPaneAsync(
        [Description(PaneDescription)] string pane,
        [Description("Nombre de dernières lignes à lire, de 1 à 2000.")] int lines = McpReadPane.DefaultLines,
        [Description("Lire la sortie complète de la dernière commande terminée au lieu des dernières lignes.")] bool lastCommand = false,
        [Description("Identifiant d’une commande rendu par tily_commands : lire sa sortie complète.")] int? commandId = null,
        CancellationToken token = default) =>
        TilyConnection.CallAsync(McpReadPane.Tool, new { pane, lines = McpReadPane.Lines(lines), lastCommand, commandId }, token);

    private static Task<CallToolResult> CommandsAsync(
        [Description("Identifiant du pane, donné par tily_layout ; absent : tous les panes démarrés.")] string? pane = null,
        [Description("Ne garder que les commandes en échec.")] bool failedOnly = false,
        [Description("Nombre maximal de commandes rendues, de 1 à 100.")] int limit = McpCommands.DefaultLimit,
        CancellationToken token = default) =>
        TilyConnection.CallAsync(McpCommands.Tool, new { pane, failedOnly, limit = McpCommands.Limit(limit) }, token);

    private static Task<CallToolResult> WaitForAsync(
        [Description(PaneDescription)] string pane,
        [Description("Texte attendu, sans tenir compte de la casse ; absent : attendre la fin de la commande en cours.")] string? pattern = null,
        [Description("Interpréter pattern comme une expression régulière JavaScript.")] bool regex = false,
        [Description("Délai maximal d’attente en secondes, de 1 à 300.")] int timeoutSeconds = McpWaitFor.DefaultTimeoutSeconds,
        CancellationToken token = default) =>
        TilyConnection.CallAsync(McpWaitFor.Tool, new { pane, pattern, regex, timeoutSeconds = McpWaitFor.TimeoutSeconds(timeoutSeconds) }, token);

    private static string? HostVersion()
    {
        var host = Path.Combine(AppContext.BaseDirectory, HostAssembly);
        if (!File.Exists(host))
        {
            return null;
        }

        var info = FileVersionInfo.GetVersionInfo(host);
        return $"{info.FileMajorPart}.{info.FileMinorPart}.{info.FileBuildPart}";
    }
}

using System.ComponentModel;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;
using Tily.Core.Mcp;

namespace Tily.Mcp;

internal static class TilyActions
{
    private const string Ownership =
        "Les onglets et panes que vous créez vous appartiennent et sont marqués « créé par Claude » : "
        + "vous pouvez y écrire (tily_run), les interrompre (tily_interrupt) et les fermer quand rien n’y tourne (tily_close) sans confirmation.";

    private const string Display =
        "Avec command, l’onglet est affiché et la commande y est lancée dès l’invite ; avec focus, il est affiché sans commande. "
        + "Sinon, il est créé sans changer ce que regarde l’utilisateur et son shell ne démarre qu’à son premier affichage (tily_focus). ";

    private const string OpenWorkspaceDescription = "Ouvre un nouveau workspace dans votre fenêtre de Tily, avec un onglet dans le dossier donné. " + Display + Ownership;

    private const string NewTabDescription =
        "Ouvre un onglet dans un workspace (par défaut, celui d’où vous êtes lancé), dans un dossier "
        + "(par défaut, le vôtre, ou celui du pane actif d’un autre workspace). " + Display + Ownership;

    private const string SplitDescription =
        "Partage un pane (par défaut, le vôtre) : right pour côte à côte, down pour haut / bas. Le nouveau pane s’ouvre dans le même dossier par défaut. "
        + "Dans l’onglet affiché, il démarre aussitôt sans prendre le focus clavier ; ailleurs, command ou focus affiche son onglet. " + Ownership;

    private const string FocusDescription =
        "Affiche un pane, un onglet ou un workspace et lui donne le focus clavier ; son shell démarre s’il ne tournait pas encore. Indiquez un seul des trois.";

    private const string RenameDescription =
        "Renomme un workspace ou un onglet (un seul des deux). Un onglet renommé garde ce nom au lieu de suivre le dossier de son pane.";

    private const string Consent =
        "Hors des panes qui vous appartiennent, Tily demande l’accord de l’utilisateur (au plus 2 minutes) ; un refus revient en erreur : ne réessayez pas sans lui demander.";

    private const string RunDescription =
        "Écrit une commande d’une ligne dans un pane, puis Entrée, comme une frappe. Le pane ne doit avoir ni commande en cours ni programme plein écran. "
        + "Avec Windows PowerShell et PowerShell 7, attend que la commande démarre (ou se termine si elle est brève) ; suivez-la ensuite avec tily_wait_for et tily_read_pane. "
        + Consent;

    private const string InterruptDescription =
        "Envoie Ctrl + C à un pane pour arrêter sa commande en cours ; avec Windows PowerShell et PowerShell 7, indique si elle s’est arrêtée. " + Consent;

    private const string CloseDescription =
        "Ferme un pane ou un onglet (un seul des deux) et arrête ses programmes ; un onglet fermé se rouvre dans Tily par Ctrl + Maj + Z. "
        + "Sans confirmation s’il vous appartient et qu’aucun programme n’y tourne ; sinon, Tily demande l’accord de l’utilisateur (au plus 2 minutes). "
        + "Votre propre pane et son onglet ne peuvent pas être fermés.";

    private const string PathDescription = "Dossier : chemin absolu, ou relatif à votre dossier courant.";
    private const string ShellDescription = "Shell : powershell (Windows PowerShell 5.1), pwsh (PowerShell 7), cmd ou gitbash.";
    private const string CommandDescription = "Commande d’une ligne lancée dès la première invite du nouveau shell.";
    private const string ShowDescription = "Afficher l’élément créé et lui donner le focus clavier, même sans commande.";
    private const string TargetPaneDescription = "Identifiant du pane, donné par tily_layout.";

    public static IEnumerable<McpServerTool> Tools() =>
    [
        McpServerTool.Create((Func<string, string?, string?, string?, bool, CancellationToken, Task<CallToolResult>>)OpenWorkspaceAsync, Options("tily_open_workspace", "Ouvrir un workspace", OpenWorkspaceDescription, false, false)),
        McpServerTool.Create((Func<string?, string?, string?, string?, string?, bool, CancellationToken, Task<CallToolResult>>)NewTabAsync, Options("tily_new_tab", "Ouvrir un onglet", NewTabDescription, false, false)),
        McpServerTool.Create((Func<string?, string, string?, string?, string?, bool, CancellationToken, Task<CallToolResult>>)SplitAsync, Options("tily_split", "Partager un pane", SplitDescription, false, false)),
        McpServerTool.Create((Func<string?, string?, string?, CancellationToken, Task<CallToolResult>>)FocusAsync, Options("tily_focus", "Afficher dans Tily", FocusDescription, false, true)),
        McpServerTool.Create((Func<string, string?, string?, CancellationToken, Task<CallToolResult>>)RenameAsync, Options("tily_rename", "Renommer", RenameDescription, false, true)),
        McpServerTool.Create((Func<string, string, CancellationToken, Task<CallToolResult>>)RunAsync, Options("tily_run", "Lancer une commande", RunDescription, true, false)),
        McpServerTool.Create((Func<string, CancellationToken, Task<CallToolResult>>)InterruptAsync, Options("tily_interrupt", "Interrompre (Ctrl + C)", InterruptDescription, true, false)),
        McpServerTool.Create((Func<string?, string?, CancellationToken, Task<CallToolResult>>)CloseAsync, Options("tily_close", "Fermer un pane ou un onglet", CloseDescription, true, false))
    ];

    private static McpServerToolCreateOptions Options(string name, string title, string description, bool destructive, bool idempotent) => new()
    {
        Name = name,
        Title = title,
        Description = description,
        ReadOnly = false,
        Idempotent = idempotent,
        Destructive = destructive,
        OpenWorld = false
    };

    private static string? Folder(string? path) => McpFolder.Resolve(path, Environment.CurrentDirectory);

    private static Task<CallToolResult> OpenWorkspaceAsync(
        [Description(PathDescription)] string path,
        [Description("Nom du workspace ; par défaut, le nom du dossier.")] string? name = null,
        [Description(ShellDescription + " Par défaut : powershell.")] string? shell = null,
        [Description(CommandDescription)] string? command = null,
        [Description(ShowDescription)] bool focus = false,
        CancellationToken token = default) =>
        TilyConnection.CallCheckedAsync(McpActions.OpenWorkspace, () => new
        {
            path = Folder(path) ?? throw new InvalidOperationException("Indiquez le dossier du workspace."),
            name = McpActions.Name(name),
            shell,
            command = McpActions.Command(command),
            focus
        }, token);

    private static Task<CallToolResult> NewTabAsync(
        [Description("Identifiant du workspace, donné par tily_layout ; par défaut, le vôtre.")] string? workspace = null,
        [Description(PathDescription)] string? path = null,
        [Description(ShellDescription + " Par défaut : powershell.")] string? shell = null,
        [Description(CommandDescription)] string? command = null,
        [Description("Nom fixe de l’onglet ; par défaut, il suit le dossier de son pane.")] string? name = null,
        [Description(ShowDescription)] bool focus = false,
        CancellationToken token = default) =>
        TilyConnection.CallCheckedAsync(McpActions.NewTab, () => new
        {
            workspace,
            path = Folder(path),
            shell,
            command = McpActions.Command(command),
            name = McpActions.Name(name),
            focus
        }, token);

    private static Task<CallToolResult> SplitAsync(
        [Description("Identifiant du pane à partager, donné par tily_layout ; par défaut, le vôtre.")] string? pane = null,
        [Description("right : côte à côte ; down : haut / bas.")] string direction = "right",
        [Description(PathDescription + " Par défaut, celui du pane partagé.")] string? path = null,
        [Description(ShellDescription + " Par défaut, celui du pane partagé.")] string? shell = null,
        [Description(CommandDescription)] string? command = null,
        [Description(ShowDescription)] bool focus = false,
        CancellationToken token = default) =>
        TilyConnection.CallCheckedAsync(McpActions.Split, () => new
        {
            pane,
            direction,
            path = Folder(path),
            shell,
            command = McpActions.Command(command),
            focus
        }, token);

    private static Task<CallToolResult> FocusAsync(
        [Description(TargetPaneDescription)] string? pane = null,
        [Description("Identifiant de l’onglet, donné par tily_layout.")] string? tab = null,
        [Description("Identifiant du workspace, donné par tily_layout.")] string? workspace = null,
        CancellationToken token = default) =>
        TilyConnection.CallAsync(McpActions.Focus, new { pane, tab, workspace }, token);

    private static Task<CallToolResult> RenameAsync(
        [Description("Nouveau nom, 100 caractères au plus.")] string name,
        [Description("Identifiant du workspace à renommer.")] string? workspace = null,
        [Description("Identifiant de l’onglet à renommer.")] string? tab = null,
        CancellationToken token = default) =>
        TilyConnection.CallCheckedAsync(McpActions.Rename, () => new
        {
            workspace,
            tab,
            name = McpActions.Name(name) ?? throw new InvalidOperationException("Indiquez le nouveau nom.")
        }, token);

    private static Task<CallToolResult> RunAsync(
        [Description(TargetPaneDescription)] string pane,
        [Description("Commande d’une ligne à lancer.")] string command,
        CancellationToken token = default) =>
        TilyConnection.CallCheckedAsync(McpActions.Run, () => new
        {
            pane,
            command = McpActions.Command(command) ?? throw new InvalidOperationException("Indiquez la commande à lancer.")
        }, token);

    private static Task<CallToolResult> InterruptAsync(
        [Description(TargetPaneDescription)] string pane,
        CancellationToken token = default) =>
        TilyConnection.CallAsync(McpActions.Interrupt, new { pane }, token);

    private static Task<CallToolResult> CloseAsync(
        [Description("Identifiant du pane à fermer, donné par tily_layout.")] string? pane = null,
        [Description("Identifiant de l’onglet à fermer, donné par tily_layout.")] string? tab = null,
        CancellationToken token = default) =>
        TilyConnection.CallAsync(McpActions.Close, new { pane, tab }, token);
}

using System.ComponentModel;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;
using Tily.Core.Mcp;

namespace Tily.Mcp;

internal static class TilyWorktreeTools
{
    private const string ListDescription =
        "Worktrees Git du dépôt d’un dossier (par défaut, votre dossier courant) : chemin, branche, dépôt principal ou non, verrouillé, "
        + "et les panes de votre fenêtre de Tily ouverts dans chacun.";

    private const string CreateDescription =
        "Crée un worktree comme Tily et comme la fonction wtr : nouvelle branche (mode new, depuis base ou la base réglée), branche locale (local) ou distante (remote) ; "
        + "ports aléatoires, pnpm install lancé dans son terminal, base de données répliquée. Il s’ouvre dans un nouveau workspace qui vous appartient, "
        + "affiché quand une installation y démarre. Rend la main à la fin de la création, réplication comprise (jusqu’à 10 minutes).";

    private const string RemoveDescription =
        "Supprime un worktree avec le dialogue de Tily : l’utilisateur confirme, et choisit de fermer les panes ouverts dedans, de garder la branche et de supprimer la base répliquée. "
        + "keepBranch et dropDatabase préremplissent ces choix. Un refus, ou l’absence de réponse en 2 minutes, revient en erreur. "
        + "Le dépôt principal et le worktree où vous tournez ne peuvent pas être supprimés.";

    public static IEnumerable<McpServerTool> Tools() =>
    [
        McpServerTool.Create((Func<string?, CancellationToken, Task<CallToolResult>>)ListAsync, new McpServerToolCreateOptions
        {
            Name = "tily_worktrees",
            Title = "Worktrees",
            Description = ListDescription,
            ReadOnly = true,
            Idempotent = true,
            Destructive = false,
            OpenWorld = false
        }),
        McpServerTool.Create((Func<string, string, string?, string?, bool, bool, string?, bool, CancellationToken, Task<CallToolResult>>)CreateAsync, new McpServerToolCreateOptions
        {
            Name = "tily_create_worktree",
            Title = "Créer un worktree",
            Description = CreateDescription,
            ReadOnly = false,
            Idempotent = false,
            Destructive = false,
            OpenWorld = false
        }),
        McpServerTool.Create((Func<string, bool, bool, CancellationToken, Task<CallToolResult>>)RemoveAsync, new McpServerToolCreateOptions
        {
            Name = "tily_remove_worktree",
            Title = "Supprimer un worktree",
            Description = RemoveDescription,
            ReadOnly = false,
            Idempotent = false,
            Destructive = true,
            OpenWorld = false
        })
    ];

    private static string Folder(string? path) =>
        McpFolder.Resolve(path, Environment.CurrentDirectory) ?? Environment.CurrentDirectory;

    private static Task<CallToolResult> ListAsync(
        [Description("Dossier d’un dépôt ou d’un worktree ; par défaut, votre dossier courant.")] string? path = null,
        CancellationToken token = default) =>
        TilyConnection.CallCheckedAsync(McpWorktrees.List, () => new { path = Folder(path) }, token);

    private static Task<CallToolResult> CreateAsync(
        [Description("Branche du worktree.")] string branch,
        [Description("new : nouvelle branche ; local : branche locale existante ; remote : branche distante.")] string mode = "new",
        [Description("Branche de départ d’une nouvelle branche ; par défaut, la base réglée dans Tily.")] string? @base = null,
        [Description("Dossier du dépôt ; par défaut, votre dossier courant.")] string? repository = null,
        [Description("Lancer l’installation des dépendances (pnpm install) dans le terminal du worktree.")] bool install = true,
        [Description("Répliquer la base de données du dépôt pour le worktree.")] bool database = true,
        [Description("Dossier parent des worktrees ; par défaut, celui réglé dans Tily pour ce projet.")] string? folder = null,
        [Description("Afficher le nouveau workspace même sans installation.")] bool focus = false,
        CancellationToken token = default) =>
        TilyConnection.CallCheckedAsync(McpWorktrees.Create, () => new
        {
            branch = McpActions.Name(branch) ?? throw new InvalidOperationException("Indiquez la branche du worktree."),
            mode,
            @base = McpActions.Name(@base),
            repository = Folder(repository),
            install,
            database,
            folder = McpFolder.Resolve(folder, Environment.CurrentDirectory),
            focus
        }, token);

    private static Task<CallToolResult> RemoveAsync(
        [Description("Dossier du worktree à supprimer, donné par tily_worktrees.")] string path,
        [Description("Garder la branche du worktree.")] bool keepBranch = false,
        [Description("Supprimer la base répliquée du worktree (jamais celle du dépôt principal).")] bool dropDatabase = true,
        CancellationToken token = default) =>
        TilyConnection.CallCheckedAsync(McpWorktrees.Remove, () => new
        {
            path = McpFolder.Resolve(path, Environment.CurrentDirectory) ?? throw new InvalidOperationException("Indiquez le dossier du worktree."),
            keepBranch,
            dropDatabase
        }, token);
}

namespace Tily.Core.Shortcuts;

public sealed record ShortcutCommandModel(string Id, string Direct = "", string Leader = "");

public static class ShortcutCatalog
{
    public const string DefaultLeader = "Ctrl+Space";
    public const int DefaultLeaderTimeoutSeconds = 5;

    public static readonly IReadOnlyList<ShortcutCommandModel> Commands =
    [
        new("palette", "Ctrl+P", "P"),
        new("newTab", "Ctrl+Shift+T", "T"),
        new("newClaudeTab", "Ctrl+Shift+K", "C"),
        new("splitSideBySide", "Ctrl+Shift+D", "V"),
        new("splitTopBottom", "Ctrl+Shift+H", "H"),
        new("newWorkspace", "Ctrl+Shift+W", "W"),
        new("projects", Leader: "F"),
        new("createWorktree", Leader: "N"),
        new("openBrowser", Leader: "U"),
        new("toggleExplorer", "Ctrl+Shift+E", "E"),
        new("toggleGit", "Ctrl+Shift+G", "G"),
        new("toggleNotes", "Ctrl+Shift+O", "O"),
        new("toggleStatusLog", "Ctrl+Shift+L", "L"),
        new("toggleSidebar", "Ctrl+Shift+B", "B"),
        new("closePane", "Ctrl+Shift+X", "X"),
        new("togglePaneZoom", "Ctrl+Shift+M", "M"),
        new("equalizePanes", Leader: "="),
        new("movePaneToNewTab", Leader: "!"),
        new("restoreTab", "Ctrl+Shift+Z", "Z"),
        new("joinWaitingAgent", "Ctrl+Shift+A", "A"),
        new("settings", Leader: ","),
        new("focusPaneLeft", "Alt+ArrowLeft", "ArrowLeft"),
        new("focusPaneRight", "Alt+ArrowRight", "ArrowRight"),
        new("focusPaneUp", "Alt+ArrowUp", "ArrowUp"),
        new("focusPaneDown", "Alt+ArrowDown", "ArrowDown"),
        new("swapPaneLeft", Leader: "Shift+ArrowLeft"),
        new("swapPaneRight", Leader: "Shift+ArrowRight"),
        new("swapPaneUp", Leader: "Shift+ArrowUp"),
        new("swapPaneDown", Leader: "Shift+ArrowDown"),
        new("moveTabLeft", "Ctrl+Shift+PageUp", "PageUp"),
        new("moveTabRight", "Ctrl+Shift+PageDown", "PageDown"),
        new("nextTab", "Ctrl+Tab"),
        new("previousTab", "Ctrl+Shift+Tab"),
        new("previousCommand", "Alt+PageUp"),
        new("nextCommand", "Alt+PageDown"),
        new("searchPane", "Ctrl+Shift+F"),
        new("browserBelow"),
        new("browserTab"),
        new("openWorktree"),
        new("removeWorktree"),
        new("openFile"),
        new("searchCommit"),
        new("focusSidebar"),
        new("renameWorkspace"),
        new("moveWorkspaceUp"),
        new("moveWorkspaceDown"),
        new("closeWorkspace"),
        new("renameTab"),
        new("autoNameTab"),
        new("duplicateTab"),
        new("closeTab"),
        new("closeOtherTabs"),
        new("closeTabsToRight"),
        new("copyPath"),
        new("copyBranch"),
        new("copyLastOutput"),
        new("clearScrollback"),
        new("openEditor"),
        new("openExplorer"),
        new("collapseFiles"),
        new("refreshFiles"),
        new("refreshGit"),
        new("fontLarger"),
        new("fontSmaller"),
        new("fontDefault"),
        new("settingsExport"),
        new("settingsImport"),
        new("searchTerminals")
    ];

    public static bool Contains(string id) => Commands.Any(command => command.Id == id);
}

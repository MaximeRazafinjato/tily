using Tily.Core.Browser;

namespace Tily.Core.Session;

public sealed record ValidationResultModel(bool IsValid, string? Error)
{
    public static ValidationResultModel Ok() => new(true, null);
    public static ValidationResultModel Fail(string error) => new(false, error);
}

public static class SessionValidator
{
    public static ValidationResultModel Validate(SessionModel? session)
    {
        if (session is null || session.Version != SessionLimits.CurrentVersion)
        {
            return ValidationResultModel.Fail("Format de session incorrect.");
        }

        var nodeCount = 0;
        foreach (var workspace in session.Workspaces)
        {
            var workspaceResult = ValidateWorkspace(workspace, ref nodeCount);
            if (!workspaceResult.IsValid)
            {
                return workspaceResult;
            }
        }

        var activeIsValid = session.Workspaces.Count == 0 ? string.IsNullOrEmpty(session.Active) : session.Workspaces.Any(workspace => workspace.Id == session.Active);
        if (!activeIsValid)
        {
            return ValidationResultModel.Fail("Workspace actif invalide.");
        }

        var closedResult = ValidateClosed(session, ref nodeCount);
        if (!closedResult.IsValid)
        {
            return closedResult;
        }

        if (session.Favorites.Count > SessionLimits.MaxFavorites || session.Favorites.Any(favorite => string.IsNullOrWhiteSpace(favorite) || favorite.Length > SessionLimits.MaxFavoriteLength))
        {
            return ValidationResultModel.Fail("Favoris invalides.");
        }

        session.Favorites = session.Favorites.Distinct().ToList();
        session.Sidebar = Math.Clamp(session.Sidebar, SessionLimits.MinSidebarWidth, SessionLimits.MaxSidebarWidth);
        session.ExplorerWidth = Math.Clamp(session.ExplorerWidth, SessionLimits.MinExplorerWidth, SessionLimits.MaxExplorerWidth);
        session.GitGraph = ClampGitGraph(session.GitGraph ?? new GitGraphLayoutModel());
        return ValidationResultModel.Ok();
    }

    private static GitGraphLayoutModel ClampGitGraph(GitGraphLayoutModel layout)
    {
        static int Column(int width) => Math.Clamp(width, SessionLimits.MinGitColumnWidth, SessionLimits.MaxGitColumnWidth);

        layout.ReferencesWidth = Math.Clamp(layout.ReferencesWidth, SessionLimits.MinGitReferencesWidth, SessionLimits.MaxGitReferencesWidth);
        layout.LabelsWidth = Column(layout.LabelsWidth);
        layout.GraphWidth = Column(layout.GraphWidth);
        layout.AuthorWidth = Column(layout.AuthorWidth);
        layout.DateWidth = Column(layout.DateWidth);
        return layout;
    }

    private static ValidationResultModel ValidateClosed(SessionModel session, ref int nodeCount)
    {
        if (session.Closed.Count > SessionLimits.MaxClosedTabs)
        {
            session.Closed = session.Closed.Skip(session.Closed.Count - SessionLimits.MaxClosedTabs).ToList();
        }

        foreach (var closed in session.Closed)
        {
            if (string.IsNullOrEmpty(closed.WorkspaceId) || closed.WorkspaceName is null || closed.Index < 0 || (closed.Text is not null && closed.Text.Values.Any(text => text is null || text.Length > SessionLimits.MaxClosedTextChars)) || closed.WorkspaceNote?.Length > SessionLimits.MaxNoteChars)
            {
                return ValidationResultModel.Fail("Onglet fermé invalide.");
            }

            var tabResult = ValidateTab(closed.Tab, ref nodeCount);
            if (!tabResult.IsValid)
            {
                return tabResult;
            }
        }

        return ValidationResultModel.Ok();
    }

    private static ValidationResultModel ValidateWorkspace(WorkspaceModel workspace, ref int nodeCount)
    {
        if (string.IsNullOrEmpty(workspace.Id) || workspace.Name is null || workspace.Tabs.Count == 0)
        {
            return ValidationResultModel.Fail("Workspace invalide.");
        }

        if (workspace.Note?.Length > SessionLimits.MaxNoteChars)
        {
            return ValidationResultModel.Fail("Note du workspace trop longue.");
        }

        foreach (var tab in workspace.Tabs)
        {
            var tabResult = ValidateTab(tab, ref nodeCount);
            if (!tabResult.IsValid)
            {
                return tabResult;
            }
        }

        return workspace.Tabs.Any(tab => tab.Id == workspace.Active)
            ? ValidationResultModel.Ok()
            : ValidationResultModel.Fail("Onglet actif invalide.");
    }

    private static ValidationResultModel ValidateTab(TabModel tab, ref int nodeCount)
    {
        if (string.IsNullOrEmpty(tab.Id) || tab.Name is null)
        {
            return ValidationResultModel.Fail("Onglet invalide.");
        }

        if (tab.Panel is not null && !SessionLimits.Panels.Contains(tab.Panel))
        {
            tab.Panel = null;
        }

        tab.Owner = ValidOwner(tab.Owner);
        var treeResult = ValidateTree(tab.Tree, 0, ref nodeCount);
        if (!treeResult.IsValid)
        {
            return treeResult;
        }

        return SplitTree.Panes(tab.Tree).Any(pane => pane.Id == tab.Active)
            ? ValidationResultModel.Ok()
            : ValidationResultModel.Fail("Pane actif invalide.");
    }

    private static ValidationResultModel ValidateTree(SplitNodeModel? node, int depth, ref int nodeCount)
    {
        if (node is null || ++nodeCount > SessionLimits.MaxNodes || depth > SessionLimits.MaxDepth)
        {
            return ValidationResultModel.Fail("Disposition invalide.");
        }

        if (node.IsLeaf)
        {
            var pane = node.Pane!;
            pane.Owner = ValidOwner(pane.Owner);
            NormalizeBrowser(pane);
            return string.IsNullOrEmpty(pane.Id) || pane.Path is null || string.IsNullOrEmpty(pane.Shell)
                ? ValidationResultModel.Fail("Pane invalide.")
                : ValidationResultModel.Ok();
        }

        if (node.Axis is not ("x" or "y") || node.Ratio is null || node.Ratio < SessionLimits.MinRatio || node.Ratio > SessionLimits.MaxRatio)
        {
            return ValidationResultModel.Fail("Split invalide.");
        }

        var left = ValidateTree(node.A, depth + 1, ref nodeCount);
        return left.IsValid ? ValidateTree(node.B, depth + 1, ref nodeCount) : left;
    }

    private static string? ValidOwner(string? owner) =>
        string.IsNullOrWhiteSpace(owner) || owner.Length > SessionLimits.MaxOwnerLength ? null : owner;

    private static void NormalizeBrowser(PaneModel pane)
    {
        if (pane.Kind != SessionLimits.BrowserPaneKind)
        {
            pane.Kind = null;
            pane.Url = null;
            pane.Viewport = null;
            return;
        }

        pane.Url = pane.Url is { Length: <= BrowserAddress.MaxLength } url && BrowserAddress.IsAllowed(url) ? url : BrowserAddress.Blank;
        pane.Viewport = pane.Viewport is BrowserViewports.Desktop or BrowserViewports.Mobile ? pane.Viewport : null;
    }
}

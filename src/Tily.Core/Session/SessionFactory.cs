using Tily.Core.Shell;

namespace Tily.Core.Session;

public static class SessionFactory
{
    public static string NewId() => Guid.NewGuid().ToString("N");

    public static PaneModel Pane(string path, string shell) => new() { Id = NewId(), Path = path, Shell = shell };

    public static TabModel Tab(string path, string shell)
    {
        var pane = Pane(path, shell);
        return new TabModel { Id = NewId(), Name = System.IO.Path.GetFileName(path.TrimEnd('\\', '/')) is { Length: > 0 } folder ? folder : shell, Manual = false, Active = pane.Id, Tree = new SplitNodeModel { Pane = pane } };
    }

    public static WorkspaceModel Workspace(string name, string path, string shell)
    {
        var tab = Tab(path, shell);
        return new WorkspaceModel { Id = NewId(), Name = name, Tabs = new List<TabModel> { tab }, Active = tab.Id, Expanded = true };
    }

    public static SessionModel Initial()
    {
        var home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        var workspace = Workspace("Général", home, ShellCatalog.DefaultShellId);
        return new SessionModel { Workspaces = new List<WorkspaceModel> { workspace }, Active = workspace.Id };
    }

    public static SessionModel InitialLike(SessionModel? template)
    {
        var session = Initial();
        if (template is null)
        {
            return session;
        }

        session.Favorites = template.Favorites.ToList();
        session.Sidebar = template.Sidebar;
        session.ExplorerWidth = template.ExplorerWidth;
        session.GitGraph = template.GitGraph;
        return session;
    }
}

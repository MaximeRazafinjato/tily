using System.Text.Json.Serialization;

namespace Tily.Core.Session;

public sealed class SessionModel
{
    public int Version { get; set; } = SessionLimits.CurrentVersion;
    public List<WorkspaceModel> Workspaces { get; set; } = new();
    public string Active { get; set; } = string.Empty;
    public int Sidebar { get; set; } = SessionLimits.DefaultSidebarWidth;
    public bool SidebarCollapsed { get; set; }
    public int ExplorerWidth { get; set; } = SessionLimits.DefaultExplorerWidth;
    public GitGraphLayoutModel? GitGraph { get; set; }
    public List<ClosedTabModel> Closed { get; set; } = new();
    public List<string> Favorites { get; set; } = new();
}

public sealed class GitGraphLayoutModel
{
    public int ReferencesWidth { get; set; } = SessionLimits.DefaultGitReferencesWidth;
    public bool ReferencesOpen { get; set; } = true;
    public int LabelsWidth { get; set; } = SessionLimits.DefaultGitLabelsWidth;
    public int GraphWidth { get; set; } = SessionLimits.DefaultGitGraphWidth;
    public int AuthorWidth { get; set; } = SessionLimits.DefaultGitAuthorWidth;
    public int DateWidth { get; set; } = SessionLimits.DefaultGitDateWidth;
    public bool AuthorShown { get; set; } = true;
    public bool DateShown { get; set; } = true;
}

public sealed class ClosedTabModel
{
    public string WorkspaceId { get; set; } = string.Empty;
    public string WorkspaceName { get; set; } = string.Empty;
    public int Index { get; set; }
    public TabModel Tab { get; set; } = new();
    public Dictionary<string, string>? Text { get; set; }
    public string? WorkspaceNote { get; set; }
}

public sealed class WorkspaceModel
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public List<TabModel> Tabs { get; set; } = new();
    public string Active { get; set; } = string.Empty;
    public bool? Expanded { get; set; }
    public string? Note { get; set; }
}

public sealed class TabModel
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool Manual { get; set; }
    public string Active { get; set; } = string.Empty;
    public bool Explorer { get; set; }
    public string? Panel { get; set; }
    public string? Owner { get; set; }
    public SplitNodeModel Tree { get; set; } = new();
}

public sealed class SplitNodeModel
{
    public PaneModel? Pane { get; set; }
    public string? Axis { get; set; }
    public double? Ratio { get; set; }
    public SplitNodeModel? A { get; set; }
    public SplitNodeModel? B { get; set; }

    [JsonIgnore]
    public bool IsLeaf => Pane is not null;
}

public sealed class PaneModel
{
    public string Id { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public string Shell { get; set; } = string.Empty;
    public string? Owner { get; set; }
    public string? Kind { get; set; }
    public string? Url { get; set; }
    public string? Viewport { get; set; }
}

public static class SessionLimits
{
    public const int CurrentVersion = 2;
    public const int MaxDepth = 30;
    public const int MaxNodes = 1000;
    public const double MinRatio = 0.1;
    public const double MaxRatio = 0.9;
    public const int MinSidebarWidth = 220;
    public const int MaxSidebarWidth = 450;
    public const int DefaultSidebarWidth = 292;
    public const int MinExplorerWidth = 200;
    public const int MaxExplorerWidth = 600;
    public const int DefaultExplorerWidth = 280;
    public const int MinGitReferencesWidth = 160;
    public const int MaxGitReferencesWidth = 420;
    public const int DefaultGitReferencesWidth = 200;
    public const int MinGitColumnWidth = 48;
    public const int MaxGitColumnWidth = 480;
    public const int DefaultGitLabelsWidth = 140;
    public const int DefaultGitGraphWidth = 100;
    public const int DefaultGitAuthorWidth = 130;
    public const int DefaultGitDateWidth = 120;
    public const int MaxClosedTabs = 5;
    public const int MaxClosedTextChars = 2_000_000;
    public const int MaxFavorites = 50;
    public const int MaxFavoriteLength = 100;
    public const int MaxNoteChars = 100_000;
    public const int MaxOwnerLength = 64;
    public const string BrowserPaneKind = "browser";
    public static readonly string[] Panels = ["files", "git", "notes"];
}

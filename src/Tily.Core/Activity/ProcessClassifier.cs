namespace Tily.Core.Activity;

public static class ProcessClassifier
{
    private static readonly HashSet<string> CommandShells = new(StringComparer.OrdinalIgnoreCase) { "bash.exe", "sh.exe", "powershell.exe", "pwsh.exe" };

    public static IReadOnlyList<(ProcessEntryModel Process, int Depth, string Category)> ClassifyPane(IReadOnlyList<ProcessEntryModel> snapshot, IReadOnlyCollection<int> paneProcessIds)
    {
        var members = snapshot.Where(process => paneProcessIds.Contains(process.Id)).ToList();
        var memberIds = members.Select(process => process.Id).ToHashSet();
        var children = members.Where(process => memberIds.Contains(process.ParentId) && process.ParentId != process.Id).ToLookup(process => process.ParentId);
        var roots = members.Where(process => !memberIds.Contains(process.ParentId) || process.ParentId == process.Id);
        var result = new List<(ProcessEntryModel, int, string)>();
        var visited = new HashSet<int>();
        foreach (var root in roots)
        {
            Visit(root, 0, ProcessCategory.Terminal);
        }

        return result;

        void Visit(ProcessEntryModel process, int depth, string inherited)
        {
            if (!visited.Add(process.Id))
            {
                return;
            }

            var category = CategoryOf(process.Name, inherited);
            result.Add((process, depth, category));
            foreach (var child in children[process.Id])
            {
                Visit(child, depth + 1, category);
            }
        }
    }

    public static IReadOnlyList<(ProcessEntryModel Process, int Depth, string Category)> ClassifyHost(IReadOnlyList<ProcessEntryModel> snapshot, int hostProcessId, IReadOnlySet<int> excludedProcessIds)
    {
        var children = snapshot.Where(process => process.ParentId != process.Id).ToLookup(process => process.ParentId);
        var result = new List<(ProcessEntryModel, int, string)>();
        var visited = new HashSet<int>();
        var host = snapshot.FirstOrDefault(process => process.Id == hostProcessId);
        if (host is not null)
        {
            Visit(host, 0);
        }

        return result;

        void Visit(ProcessEntryModel process, int depth)
        {
            if (excludedProcessIds.Contains(process.Id) || !visited.Add(process.Id))
            {
                return;
            }

            var category = depth == 0 ? ProcessCategory.App : process.Name.Equals("msedgewebview2.exe", StringComparison.OrdinalIgnoreCase) ? ProcessCategory.WebView : ProcessCategory.Other;
            result.Add((process, depth, category));
            foreach (var child in children[process.Id])
            {
                Visit(child, depth + 1);
            }
        }
    }

    private static string CategoryOf(string name, string inherited)
    {
        if (name.Equals("claude.exe", StringComparison.OrdinalIgnoreCase))
        {
            return ProcessCategory.Claude;
        }

        if (inherited != ProcessCategory.Claude || name.Equals("conhost.exe", StringComparison.OrdinalIgnoreCase))
        {
            return inherited;
        }

        return CommandShells.Contains(name) ? ProcessCategory.Commands : ProcessCategory.Mcp;
    }
}

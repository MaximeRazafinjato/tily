namespace Tily.Core.Activity;

public static class ProcessNames
{
    public static IReadOnlyDictionary<int, string> Snapshot()
    {
        var names = new Dictionary<int, string>();
        foreach (var process in new WindowsProcessProbe().Snapshot())
        {
            names.TryAdd(process.Id, Path.GetFileNameWithoutExtension(process.Name));
        }

        return names;
    }
}

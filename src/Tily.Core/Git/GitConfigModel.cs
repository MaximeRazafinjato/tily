namespace Tily.Core.Git;

public sealed class GitConfigModel
{
    private readonly Dictionary<string, string> _values;

    private GitConfigModel(Dictionary<string, string> values) => _values = values;

    public static GitConfigModel Parse(string output)
    {
        var values = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var entry in output.Split('\0', StringSplitOptions.RemoveEmptyEntries))
        {
            var separator = entry.IndexOf('\n');
            var key = separator < 0 ? entry : entry[..separator];
            values[Normalize(key)] = separator < 0 ? string.Empty : entry[(separator + 1)..];
        }

        return new GitConfigModel(values);
    }

    public string? Get(string key) => _values.TryGetValue(Normalize(key), out var value) && value.Trim().Length > 0 ? value.Trim() : null;

    private static string Normalize(string key)
    {
        var first = key.IndexOf('.');
        var last = key.LastIndexOf('.');
        return first < 0 || first == last
            ? key.ToLowerInvariant()
            : $"{key[..first].ToLowerInvariant()}{key[first..last]}{key[last..].ToLowerInvariant()}";
    }
}

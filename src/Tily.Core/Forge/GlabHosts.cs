namespace Tily.Core.Forge;

public static class GlabHosts
{
    private const string ConfigFolder = "glab-cli";
    private const string ConfigFile = "config.yml";
    private const string HostsKey = "hosts:";

    public static IReadOnlySet<string> Read()
    {
        try
        {
            var path = ConfigPaths().FirstOrDefault(File.Exists);
            return path is null ? new HashSet<string>() : Parse(File.ReadAllLines(path));
        }
        catch (IOException)
        {
            return new HashSet<string>();
        }
        catch (UnauthorizedAccessException)
        {
            return new HashSet<string>();
        }
    }

    public static IReadOnlySet<string> Parse(IEnumerable<string> lines)
    {
        var hosts = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var inHosts = false;
        int? hostIndent = null;
        foreach (var line in lines)
        {
            var content = line.TrimEnd();
            if (content.TrimStart().Length == 0 || content.TrimStart().StartsWith('#'))
            {
                continue;
            }

            var indent = content.Length - content.TrimStart().Length;
            if (indent == 0)
            {
                inHosts = content == HostsKey;
                hostIndent = null;
                continue;
            }

            if (!inHosts)
            {
                continue;
            }

            hostIndent ??= indent;
            if (indent == hostIndent && content.EndsWith(':'))
            {
                hosts.Add(content.Trim().TrimEnd(':').Trim('"', '\'').ToLowerInvariant());
            }
        }

        return hosts;
    }

    private static IEnumerable<string> ConfigPaths()
    {
        var configured = Environment.GetEnvironmentVariable("GLAB_CONFIG_DIR");
        if (!string.IsNullOrWhiteSpace(configured))
        {
            yield return Path.Combine(configured, ConfigFile);
        }

        var xdg = Environment.GetEnvironmentVariable("XDG_CONFIG_HOME");
        if (!string.IsNullOrWhiteSpace(xdg))
        {
            yield return Path.Combine(xdg, ConfigFolder, ConfigFile);
        }

        yield return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), ConfigFolder, ConfigFile);
        yield return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".config", ConfigFolder, ConfigFile);
    }
}

using System.Text.RegularExpressions;

namespace Tily.Core.Clone;

public sealed partial class CloneProgress(string name, Action<string> report)
{
    private string? _last;

    public void Report(string line)
    {
        if (Describe(line) is not { } step)
        {
            return;
        }

        var message = $"Clonage de « {name} » : {step}.";
        if (message == _last)
        {
            return;
        }

        _last = message;
        report(message);
    }

    public static string? Describe(string line)
    {
        var match = Step().Match(line.Trim());
        if (!match.Success)
        {
            return null;
        }

        var label = match.Groups["step"].Value switch
        {
            "Counting objects" => "décompte des objets",
            "Compressing objects" => "compression des objets",
            "Receiving objects" => "réception des objets",
            "Resolving deltas" => "résolution des deltas",
            _ => "extraction des fichiers"
        };
        return $"{label}, {match.Groups["percent"].Value} %";
    }

    [GeneratedRegex(@"^(?:remote:\s*)?(?<step>Counting objects|Compressing objects|Receiving objects|Resolving deltas|Updating files):\s+(?<percent>\d{1,3})%")]
    private static partial Regex Step();
}

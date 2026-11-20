using System.Text;
using System.Text.RegularExpressions;

namespace Tily.Core.Worktrees;

public static partial class ClaudeLaunchCommand
{
    public const int PromptMaxLength = 4000;

    private const string Executable = "claude";
    private const string EndOfOptions = " --";
    private static readonly char[] PowerShellQuotes = ['\'', '‘', '’', '‚', '‛'];

    public static string? For(bool requested, string? prompt)
    {
        if (!requested)
        {
            return null;
        }

        var text = Flatten(prompt);
        if (text.Length == 0)
        {
            return Executable;
        }

        if (text.Length > PromptMaxLength)
        {
            throw new WorktreeException($"Le texte pour Claude Code dépasse {PromptMaxLength} caractères.", WorktreeSteps.Verification);
        }

        var separator = text.StartsWith('-') ? EndOfOptions : string.Empty;
        return $"{Executable}{separator} '{DoublePowerShellQuotes(EscapeNativeArgument(text))}'";
    }

    private static string Flatten(string? prompt) =>
        string.Concat(Whitespace().Replace(prompt ?? string.Empty, " ").Trim().Where(character => !char.IsControl(character)));

    private static string EscapeNativeArgument(string text)
    {
        var escaped = new StringBuilder();
        var backslashes = 0;
        foreach (var character in text)
        {
            if (character == '\\')
            {
                backslashes++;
                continue;
            }

            escaped.Append('\\', character == '"' ? backslashes * 2 + 1 : backslashes).Append(character);
            backslashes = 0;
        }

        return escaped.Append('\\', text.Contains(' ') ? backslashes * 2 : backslashes).ToString();
    }

    private static string DoublePowerShellQuotes(string text) =>
        string.Concat(text.Select(character => PowerShellQuotes.Contains(character) ? $"{character}{character}" : character.ToString()));

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();
}

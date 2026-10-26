using Tily.Core.Git;

namespace Tily.Core.Forge;

public static class ForgeOrigin
{
    private static readonly GitRunner Runner = new();

    public static string Read(string path)
    {
        GitOutputModel output;
        try
        {
            output = Runner.Run(path, ["remote", "get-url", "origin"], new GitRunOptionsModel(NeutralLocale: true, Timeout: TimeSpan.FromSeconds(10)));
        }
        catch (GitCommandException exception)
        {
            throw new ForgeException(exception.Message);
        }

        if (output.Succeeded && output.Output.Trim().Length > 0)
        {
            return output.Output.Trim();
        }

        throw new ForgeException(output.Error.Contains("not a git repository", StringComparison.OrdinalIgnoreCase)
            ? $"Aucun dépôt Git dans {path}."
            : "Aucun dépôt distant « origin » : Tily reconnaît l’hébergeur des MR/PR à l’adresse de « origin ».");
    }
}

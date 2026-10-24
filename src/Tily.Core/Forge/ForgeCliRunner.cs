using System.Diagnostics;
using System.Text;

namespace Tily.Core.Forge;

public interface IForgeCommandRunner
{
    ForgeOutputModel Run(ForgeKind kind, string directory, IReadOnlyList<string> arguments, string? input = null);
}

public sealed class ForgeCliRunner : IForgeCommandRunner
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(20);
    private static readonly UTF8Encoding Utf8 = new(false);

    private static string ProgramFiles => Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);

    private static string LocalPrograms => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs");

    public static string CliName(ForgeKind kind) => kind == ForgeKind.GitHub ? "gh" : "glab";

    public ForgeOutputModel Run(ForgeKind kind, string directory, IReadOnlyList<string> arguments, string? input = null)
    {
        var executable = Locate(kind) ?? throw new ForgeException(MissingCli(kind));
        using var process = new Process { StartInfo = StartInfo(executable, directory, arguments) };
        process.Start();
        var output = process.StandardOutput.ReadToEndAsync();
        var error = process.StandardError.ReadToEndAsync();
        if (input is not null)
        {
            process.StandardInput.Write(input);
        }

        process.StandardInput.Close();
        if (!process.WaitForExit(Timeout))
        {
            process.Kill(true);
            throw new ForgeException($"« {CliName(kind)} » ne répond pas après {Timeout.TotalSeconds:0} s : commande arrêtée.");
        }

        process.WaitForExit();
        return new ForgeOutputModel(process.ExitCode, output.GetAwaiter().GetResult(), error.GetAwaiter().GetResult());
    }

    private static string? Locate(ForgeKind kind) => kind == ForgeKind.GitHub
        ? Find("gh.exe", Path.Combine(ProgramFiles, "GitHub CLI"))
        : Find("glab.exe", Path.Combine(LocalPrograms, "glab"), Path.Combine(ProgramFiles, "glab"));

    private static string MissingCli(ForgeKind kind) => kind == ForgeKind.GitHub
        ? "GitHub CLI (gh) est introuvable : installez-le (winget install GitHub.cli), puis lancez « gh auth login » dans un terminal."
        : "GitLab CLI (glab) est introuvable : installez-le (winget install GLab.GLab), puis lancez « glab auth login » dans un terminal.";

    private static ProcessStartInfo StartInfo(string executable, string directory, IReadOnlyList<string> arguments)
    {
        if (!Directory.Exists(directory))
        {
            throw new ForgeException($"Dossier introuvable : {directory}");
        }

        var info = new ProcessStartInfo(executable)
        {
            WorkingDirectory = directory,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardInputEncoding = Utf8,
            StandardOutputEncoding = Utf8,
            StandardErrorEncoding = Utf8
        };
        foreach (var argument in arguments)
        {
            info.ArgumentList.Add(argument);
        }

        info.Environment["NO_COLOR"] = "1";
        info.Environment["CLICOLOR"] = "0";
        info.Environment["GH_PROMPT_DISABLED"] = "1";
        info.Environment["GH_NO_UPDATE_NOTIFIER"] = "1";
        info.Environment["NO_PROMPT"] = "1";
        info.Environment["GLAB_CHECK_UPDATE"] = "false";
        return info;
    }

    private static string? Find(string executable, params string[] knownFolders)
    {
        var directories = (Environment.GetEnvironmentVariable("PATH") ?? string.Empty)
            .Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(directory => directory.Trim('"'))
            .Concat(knownFolders)
            .Append(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft", "WinGet", "Links"))
            .Append(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "scoop", "shims"));
        foreach (var directory in directories)
        {
            try
            {
                var candidate = Path.Combine(directory, executable);
                if (File.Exists(candidate))
                {
                    return candidate;
                }
            }
            catch (ArgumentException)
            {
            }
        }

        return null;
    }
}

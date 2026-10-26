using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;

namespace Tily.Core.Git;

public sealed record GitRunOptionsModel(string? Input = null, bool NeutralLocale = false, bool LiteralPaths = false, TimeSpan? Timeout = null);

public sealed record GitOutputModel(int ExitCode, string Output, string Error)
{
    public bool Succeeded => ExitCode == 0;

    public string Details => GitRunner.Clean(string.Join('\n', new[] { Error, Output }.Where(text => text.Trim().Length > 0)));
}

public sealed partial class GitRunner
{
    private const string GitExecutable = "git.exe";
    private const string LauncherDirectory = "cmd";
    private const string ShellSystem = "MINGW64";
    private static readonly TimeSpan DefaultTimeout = TimeSpan.FromMinutes(10);
    private static readonly UTF8Encoding Utf8 = new(false);
    private static readonly Lazy<GitInstallationModel?> InstalledGit = new(() => FindGit() is { } launcher ? GitInstallationModel.Of(launcher) : null);
    private static readonly string[] CommonArguments = ["-c", "core.quotepath=false", "-c", "color.ui=false", "--no-optional-locks"];

    private readonly IReadOnlyDictionary<string, string?> _environment;

    public GitRunner(IReadOnlyDictionary<string, string?>? environment = null) => _environment = environment ?? new Dictionary<string, string?>();

    public static bool IsInstalled => InstalledGit.Value is not null;

    public GitOutputModel Run(string directory, IEnumerable<string> arguments, GitRunOptionsModel? options = null)
    {
        var settings = options ?? new GitRunOptionsModel();
        using var process = new Process { StartInfo = StartInfo(directory, arguments, settings) };
        process.Start();
        var output = process.StandardOutput.ReadToEndAsync();
        var error = process.StandardError.ReadToEndAsync();
        WriteInput(process, settings.Input);
        Wait(process, settings.Timeout ?? DefaultTimeout);
        return new GitOutputModel(process.ExitCode, output.GetAwaiter().GetResult(), error.GetAwaiter().GetResult());
    }

    public byte[] ReadBytes(string directory, params string[] arguments)
    {
        using var process = new Process { StartInfo = StartInfo(directory, arguments, new GitRunOptionsModel()) };
        process.Start();
        using var buffer = new MemoryStream();
        var copy = process.StandardOutput.BaseStream.CopyToAsync(buffer);
        var error = process.StandardError.ReadToEndAsync();
        process.StandardInput.Close();
        Wait(process, DefaultTimeout);
        copy.GetAwaiter().GetResult();
        if (process.ExitCode != 0)
        {
            throw new GitCommandException($"La commande « git {arguments.FirstOrDefault()} » a échoué.", Clean(error.GetAwaiter().GetResult()));
        }

        return buffer.ToArray();
    }

    public static string Clean(string text) => AnsiEscape().Replace(text, string.Empty).Replace("\r\n", "\n").Trim();

    private ProcessStartInfo StartInfo(string directory, IEnumerable<string> arguments, GitRunOptionsModel options)
    {
        if (!Directory.Exists(directory))
        {
            throw new GitCommandException($"Dossier introuvable : {directory}", string.Empty);
        }

        var installation = InstalledGit.Value ?? throw new GitCommandException("Git est introuvable : installez Git pour Windows ou ajoutez git.exe au PATH.", string.Empty);
        var info = new ProcessStartInfo(installation.Executable)
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
        foreach (var argument in CommonArguments)
        {
            info.ArgumentList.Add(argument);
        }

        if (options.LiteralPaths)
        {
            info.ArgumentList.Add("--literal-pathspecs");
        }

        foreach (var argument in arguments)
        {
            info.ArgumentList.Add(argument);
        }

        if (installation.SearchPath is { } searchPath)
        {
            info.Environment["PATH"] = $"{searchPath}{Path.PathSeparator}{Environment.GetEnvironmentVariable("PATH")}";
            info.Environment["MSYSTEM"] = ShellSystem;
            info.Environment["PLINK_PROTOCOL"] = Environment.GetEnvironmentVariable("PLINK_PROTOCOL") ?? "ssh";
        }

        info.Environment["GIT_TERMINAL_PROMPT"] = "0";
        info.Environment["GIT_EDITOR"] = "true";
        info.Environment["GIT_MERGE_AUTOEDIT"] = "no";
        if (options.NeutralLocale)
        {
            info.Environment["LC_ALL"] = "C";
        }

        foreach (var (name, value) in _environment)
        {
            info.Environment[name] = value;
        }

        return info;
    }

    private static void WriteInput(Process process, string? input)
    {
        if (input is not null)
        {
            process.StandardInput.Write(input);
        }

        process.StandardInput.Close();
    }

    private static void Wait(Process process, TimeSpan timeout)
    {
        if (process.WaitForExit(timeout))
        {
            process.WaitForExit();
            return;
        }

        process.Kill(true);
        throw new GitCommandException($"Git ne répond plus après {timeout.TotalMinutes:0} minutes : commande arrêtée.", string.Empty);
    }

    private static string? FindGit()
    {
        var directories = (Environment.GetEnvironmentVariable("PATH") ?? string.Empty).Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var candidates = directories
            .Select(directory => directory.Trim('"'))
            .Append(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Git", "cmd"));
        foreach (var directory in candidates)
        {
            try
            {
                var candidate = Path.Combine(directory, GitExecutable);
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

    private sealed record GitInstallationModel(string Executable, string? SearchPath)
    {
        public static GitInstallationModel Of(string launcher)
        {
            var directory = Path.GetDirectoryName(launcher);
            var top = Path.GetDirectoryName(directory);
            if (top is null || !string.Equals(Path.GetFileName(directory), LauncherDirectory, StringComparison.OrdinalIgnoreCase))
            {
                return new GitInstallationModel(launcher, null);
            }

            var binaries = Path.Combine(top, ShellSystem.ToLowerInvariant(), "bin");
            var executable = Path.Combine(binaries, GitExecutable);
            var tools = Path.Combine(top, "usr", "bin");
            if (!File.Exists(executable) || !Directory.Exists(tools))
            {
                return new GitInstallationModel(launcher, null);
            }

            var home = Environment.GetEnvironmentVariable("HOME") ?? Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            return new GitInstallationModel(executable, string.Join(Path.PathSeparator, binaries, tools, Path.Combine(home, "bin")));
        }
    }

    [GeneratedRegex(@"\x1B\[[0-?]*[ -/]*[@-~]")]
    private static partial Regex AnsiEscape();
}

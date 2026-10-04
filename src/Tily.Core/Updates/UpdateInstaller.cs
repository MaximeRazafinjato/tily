using System.Diagnostics;

namespace Tily.Core.Updates;

public static class UpdateInstaller
{
    public const string UninstallerName = "unins000.exe";

    public static bool IsInstalled(string appDirectory) => File.Exists(Path.Combine(appDirectory, UninstallerName));

    public static bool IsAllUsers(string appDirectory) =>
        new[] { Environment.SpecialFolder.ProgramFiles, Environment.SpecialFolder.ProgramFilesX86 }
            .Select(Environment.GetFolderPath)
            .Where(folder => folder.Length > 0)
            .Any(folder => Path.GetFullPath(appDirectory).StartsWith(Path.TrimEndingDirectorySeparator(Path.GetFullPath(folder)) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase));

    public static string Arguments(bool allUsers, IEnumerable<int> processIds) =>
        string.Join(' ', "/SILENT", "/NORESTART", allUsers ? "/ALLUSERS" : "/CURRENTUSER", "/RELAUNCH=1", $"/WAITPID={string.Join(',', processIds.Distinct())}");

    public static void Start(string installerPath, string appDirectory, IEnumerable<int> processIds)
    {
        if (!File.Exists(installerPath))
        {
            throw new UpdateException($"Installeur introuvable : {installerPath}");
        }

        Process.Start(new ProcessStartInfo(installerPath)
        {
            Arguments = Arguments(IsAllUsers(appDirectory), processIds),
            UseShellExecute = true,
            WorkingDirectory = Path.GetDirectoryName(installerPath) ?? string.Empty
        });
    }
}

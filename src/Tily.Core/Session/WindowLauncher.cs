using System.Diagnostics;

namespace Tily.Core.Session;

public static class WindowLauncher
{
    public static void OpenNew() => Start([InstanceStartup.NewWindowArgument]);

    public static void Restore(string sessionId) => Start([InstanceStartup.SessionArgument, sessionId]);

    private static void Start(IEnumerable<string> arguments)
    {
        var info = new ProcessStartInfo(Environment.ProcessPath ?? throw new InvalidOperationException("Impossible d’ouvrir une fenêtre : chemin de Tily introuvable.")) { UseShellExecute = false };
        foreach (var argument in arguments)
        {
            info.ArgumentList.Add(argument);
        }

        Process.Start(info)?.Dispose();
    }
}

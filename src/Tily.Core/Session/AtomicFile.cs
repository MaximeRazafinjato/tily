using System.Text;

namespace Tily.Core.Session;

public static class AtomicFile
{
    private const int ReplaceAttempts = 5;
    private static readonly TimeSpan ReplaceDelay = TimeSpan.FromMilliseconds(20);

    public static void Write(string filePath, string content)
    {
        var temporaryPath = filePath + ".tmp";
        using (var stream = new FileStream(temporaryPath, FileMode.Create, FileAccess.Write, FileShare.None))
        {
            var bytes = new UTF8Encoding(false).GetBytes(content);
            stream.Write(bytes);
            stream.Flush(true);
        }

        for (var attempt = 1; ; attempt++)
        {
            try
            {
                File.Move(temporaryPath, filePath, true);
                return;
            }
            catch (Exception exception) when (exception is IOException or UnauthorizedAccessException && attempt < ReplaceAttempts)
            {
                Thread.Sleep(ReplaceDelay * attempt);
            }
        }
    }
}

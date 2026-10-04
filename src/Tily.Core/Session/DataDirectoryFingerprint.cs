using System.Security.Cryptography;
using System.Text;

namespace Tily.Core.Session;

public static class DataDirectoryFingerprint
{
    private const int HashChars = 24;

    public static string Of(string dataDirectory)
    {
        var normalized = Path.TrimEndingDirectorySeparator(Path.GetFullPath(dataDirectory)).ToUpperInvariant();
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(normalized)));
        return hash[..HashChars].ToLowerInvariant();
    }
}

using System.Security.Cryptography;
using System.Text;

namespace Tily.Core.Agents;

public static class ShinyRoll
{
    public const int Odds = 512;

    public static bool IsShiny(string? seed) =>
        !string.IsNullOrWhiteSpace(seed) && BitConverter.ToUInt32(SHA256.HashData(Encoding.UTF8.GetBytes(seed))) % Odds == 0;
}

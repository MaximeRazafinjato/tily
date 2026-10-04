namespace Tily.Core.Session;

public sealed class SessionClaim : IDisposable
{
    private readonly FileStream _lock;

    internal SessionClaim(string id, string directory, FileStream lockFile)
    {
        Id = id;
        Directory = directory;
        _lock = lockFile;
    }

    public string Id { get; }

    public string Directory { get; }

    public void Dispose() => _lock.Dispose();
}

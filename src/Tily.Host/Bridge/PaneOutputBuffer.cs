using System.Text;

namespace Tily.Host.Bridge;

public sealed class PaneOutputBuffer
{
    private const long UnackedCharsLimit = 4L * 1024 * 1024;

    private readonly Decoder _decoder = Encoding.UTF8.GetDecoder();
    private readonly object _sync = new();
    private readonly ManualResetEventSlim _flowGate = new(true);
    private StringBuilder _pending = new();
    private long _unackedChars;

    public string PaneId { get; }

    public PaneOutputBuffer(string paneId) => PaneId = paneId;

    public void Append(ReadOnlySpan<byte> data)
    {
        var chars = new char[_decoder.GetCharCount(data, false)];
        var written = _decoder.GetChars(data, chars, false);
        lock (_sync)
        {
            _pending.Append(chars, 0, written);
        }

        if (Interlocked.Add(ref _unackedChars, written) >= UnackedCharsLimit)
        {
            _flowGate.Reset();
            _flowGate.Wait(TimeSpan.FromSeconds(10));
        }
    }

    public string? Take()
    {
        lock (_sync)
        {
            if (_pending.Length == 0)
            {
                return null;
            }

            var taken = _pending;
            _pending = new StringBuilder();
            return taken.ToString();
        }
    }

    public void Acknowledge(int chars)
    {
        if (Interlocked.Add(ref _unackedChars, -chars) < UnackedCharsLimit)
        {
            _flowGate.Set();
        }
    }

    public void ResetFlow()
    {
        Interlocked.Exchange(ref _unackedChars, 0);
        _flowGate.Set();
    }

    public void Release() => _flowGate.Set();
}

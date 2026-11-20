using System.Collections.Concurrent;
using Tily.Core.Terminal;

namespace Tily.Host.Bridge;

public sealed class PaneRouter
{
    private readonly TerminalManager _terminals;
    private readonly ConcurrentDictionary<string, HostBridge> _owners = new();
    private readonly ConcurrentDictionary<string, PaneOutputBuffer> _buffers = new();

    public PaneRouter(TerminalManager terminals)
    {
        _terminals = terminals;
        terminals.OutputReceived += HandleOutput;
        terminals.CurrentDirectoryChanged += HandleCurrentDirectoryChanged;
        terminals.Exited += (paneId, code) => OwnerOf(paneId)?.PostPaneEvent(paneId, new { type = "terminal.exit", pane = paneId, code });
    }

    public HostBridge? OwnerOf(string paneId) => _owners.TryGetValue(paneId, out var owner) ? owner : null;

    public bool IsElsewhere(HostBridge bridge, string paneId) => OwnerOf(paneId) is { } owner && owner != bridge;

    public IReadOnlyList<string> PanesOf(HostBridge bridge) => _owners.Where(entry => entry.Value == bridge).Select(entry => entry.Key).ToList();

    public IEnumerable<PaneOutputBuffer> BuffersOf(HostBridge bridge) => _buffers.Values.Where(buffer => OwnerOf(buffer.PaneId) == bridge);

    public void Start(HostBridge owner, string paneId)
    {
        Close(paneId);
        _buffers[paneId] = new PaneOutputBuffer(paneId);
        _owners[paneId] = owner;
    }

    public void Close(string paneId)
    {
        if (_buffers.TryRemove(paneId, out var buffer))
        {
            buffer.Release();
        }

        _owners.TryRemove(paneId, out _);
    }

    public void Acknowledge(HostBridge bridge, string paneId, int chars)
    {
        if (OwnerOf(paneId) == bridge && _buffers.TryGetValue(paneId, out var buffer))
        {
            buffer.Acknowledge(chars);
        }
    }

    public IReadOnlyList<string> Transfer(IEnumerable<string> paneIds, HostBridge source, HostBridge destination)
    {
        var moved = new List<string>();
        foreach (var paneId in paneIds.Distinct(StringComparer.Ordinal))
        {
            if (OwnerOf(paneId) != source)
            {
                continue;
            }

            _owners[paneId] = destination;
            if (_buffers.TryGetValue(paneId, out var buffer))
            {
                buffer.ResetFlow();
            }

            moved.Add(paneId);
        }

        return moved;
    }

    public void ReleaseAll()
    {
        foreach (var buffer in _buffers.Values)
        {
            buffer.Release();
        }
    }

    private void HandleOutput(string paneId, ReadOnlyMemory<byte> data)
    {
        if (!_buffers.TryGetValue(paneId, out var buffer))
        {
            return;
        }

        buffer.Append(data.Span);
        OwnerOf(paneId)?.ScheduleFlush();
    }

    private void HandleCurrentDirectoryChanged(string paneId, string path)
    {
        OwnerOf(paneId)?.PostPaneEvent(paneId, new { type = "terminal.cwd", pane = paneId, path });
        foreach (var missing in _terminals.MissingDirectories())
        {
            OwnerOf(missing.PaneId)?.PostPaneEvent(missing.PaneId, new { type = "terminal.pathMissing", pane = missing.PaneId, path = missing.Path, fallback = missing.Fallback });
        }
    }
}

namespace Tily.Host.Bridge;

public sealed class HeldPanes
{
    private readonly HashSet<string> _panes = new(StringComparer.Ordinal);
    private readonly List<HeldPaneEventModel> _events = [];

    public bool Contains(string paneId) => _panes.Contains(paneId);

    public void Hold(IEnumerable<string> paneIds) => _panes.UnionWith(paneIds);

    public bool Queue(string paneId, object message)
    {
        if (!_panes.Contains(paneId))
        {
            return false;
        }

        _events.Add(new HeldPaneEventModel(paneId, message));
        return true;
    }

    public IReadOnlyList<HeldPaneEventModel> Release(IEnumerable<string> paneIds)
    {
        _panes.ExceptWith(paneIds);
        var released = _events.Where(entry => !_panes.Contains(entry.PaneId)).ToList();
        _events.RemoveAll(entry => !_panes.Contains(entry.PaneId));
        return released;
    }
}

public sealed record HeldPaneEventModel(string PaneId, object Message);

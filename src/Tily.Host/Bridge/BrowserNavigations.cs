namespace Tily.Host.Bridge;

internal sealed class BrowserNavigations(Func<string, BrowserNavigationModel> timedOut)
{
    private const string LoadTooLong = "La page n’a pas fini de charger dans le délai imparti.";

    private readonly List<BrowserNavigationWaiter> _waiters = [];

    public async Task<BrowserNavigationModel> WaitAsync(Action start, TimeSpan timeout)
    {
        var waiter = Add();
        try
        {
            start();
            return await CompletionAsync(waiter, timeout);
        }
        finally
        {
            _waiters.Remove(waiter);
        }
    }

    public async Task<BrowserNavigationModel?> FollowAsync(Func<Task> action, Func<Task> settle, TimeSpan timeout)
    {
        var waiter = Add();
        try
        {
            await action();
            await settle();
            return waiter.NavigationId is null ? null : await CompletionAsync(waiter, timeout);
        }
        finally
        {
            _waiters.Remove(waiter);
        }
    }

    public void Started(ulong navigationId)
    {
        foreach (var waiter in _waiters.Where(waiter => waiter.NavigationId is null))
        {
            waiter.NavigationId = navigationId;
        }
    }

    public void Completed(ulong navigationId, BrowserNavigationModel result)
    {
        foreach (var waiter in _waiters.Where(waiter => waiter.NavigationId == navigationId).ToList())
        {
            waiter.Completion.TrySetResult(result);
        }
    }

    public void Close()
    {
        foreach (var waiter in _waiters.ToList())
        {
            waiter.Completion.TrySetException(new InvalidOperationException("Le pane navigateur a été fermé."));
        }
    }

    private BrowserNavigationWaiter Add()
    {
        var waiter = new BrowserNavigationWaiter();
        _waiters.Add(waiter);
        return waiter;
    }

    private async Task<BrowserNavigationModel> CompletionAsync(BrowserNavigationWaiter waiter, TimeSpan timeout)
    {
        try
        {
            return await waiter.Completion.Task.WaitAsync(timeout);
        }
        catch (TimeoutException)
        {
            return timedOut(LoadTooLong);
        }
    }
}

internal sealed class BrowserNavigationWaiter
{
    public TaskCompletionSource<BrowserNavigationModel> Completion { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);

    public ulong? NavigationId { get; set; }
}

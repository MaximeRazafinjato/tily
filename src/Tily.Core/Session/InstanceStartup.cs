namespace Tily.Core.Session;

public sealed record InstanceStartupModel(SessionClaim? Claim, IReadOnlyList<string> Others, bool ColdStart);

public static class InstanceStartup
{
    public const string SessionArgument = "--session";
    public const string NewWindowArgument = "--new-window";

    public static InstanceStartupModel Resolve(SessionStore store, IReadOnlyList<string> arguments, Action clearTransientFiles)
    {
        using var gate = store.EnterGate();
        store.MigrateLegacy();
        var ids = store.Ids();
        var cold = !ids.Any(store.IsOpen);
        if (cold)
        {
            clearTransientFiles();
        }

        if (RequestedSession(arguments) is { } requested)
        {
            return new InstanceStartupModel(store.TryClaim(requested), [], cold);
        }

        if (!cold || arguments.Contains(NewWindowArgument, StringComparer.OrdinalIgnoreCase))
        {
            return new InstanceStartupModel(store.Create(), [], cold);
        }

        var restorable = new List<string>();
        foreach (var id in ids)
        {
            if (store.IsRestorable(id))
            {
                restorable.Add(id);
            }
            else
            {
                store.Forget(id);
            }
        }

        var claim = restorable.Count > 0 ? store.TryClaim(restorable[0]) : null;
        return claim is null
            ? new InstanceStartupModel(store.Create(), [], true)
            : new InstanceStartupModel(claim, restorable.Skip(1).ToList(), true);
    }

    public static string? RequestedSession(IReadOnlyList<string> arguments)
    {
        var index = arguments.ToList().FindIndex(argument => argument.Equals(SessionArgument, StringComparison.OrdinalIgnoreCase));
        return index >= 0 && index + 1 < arguments.Count && SessionStore.IsValidId(arguments[index + 1]) ? arguments[index + 1] : null;
    }
}

namespace Tily.Core.Shortcuts;

public sealed record ShortcutBindingModel(string? Direct = null, string? Leader = null);

public sealed class ShortcutSettingsModel
{
    public string? Leader { get; set; } = ShortcutCatalog.DefaultLeader;
    public int? LeaderTimeoutSeconds { get; set; } = ShortcutCatalog.DefaultLeaderTimeoutSeconds;
    public Dictionary<string, ShortcutBindingModel>? Bindings { get; set; } = new();

    public static ShortcutSettingsModel Default => ShortcutRules.Resolve(null);
}

public sealed record ShortcutResolutionModel(ShortcutSettingsModel Settings, string? Error);

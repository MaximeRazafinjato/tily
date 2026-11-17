namespace Tily.Core.Appearance;

public static class AmbiancePresets
{
    public static readonly AmbiancePresetModel Rainbow = new("Arc-en-ciel", new(["#ff0040", "#ff8a00", "#ffe600", "#00e676", "#00b0ff", "#7c4dff", "#ff00c8"], AmbianceGradientType.Linear, 120, 1600, 12));

    public static readonly IReadOnlyList<AmbiancePresetModel> All =
    [
        Rainbow,
        new("Néon", new(["#00f0ff", "#ff00d4", "#7a00ff"], AmbianceGradientType.Linear, 135, 1200, 8)),
        new("Aurore", new(["#00ff9d", "#00c3ff", "#5b3cff", "#b100ff"], AmbianceGradientType.Radial, 0, 900, 16)),
        new("Lave", new(["#ff2a00", "#ff8a00", "#b3001b", "#ffd000"], AmbianceGradientType.Plasma, 0, 1600, 20)),
        new("Constellation", new(["#7ab8ff", "#c79bff", "#ffffff"], AmbianceGradientType.Particles, 0, 1500, 12))
    ];
}

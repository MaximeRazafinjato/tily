using System.Text.Json.Serialization;

namespace Tily.Core.Appearance;

public sealed record CompanionOutfitModel(string? Hat = null, string? Face = null, string? Skin = null, string? Trail = null, string? Animation = null)
{
    public static readonly IReadOnlySet<string> Hats = new HashSet<string>(["cap", "beanie", "cowboy", "chef", "topHat", "viking", "propeller", "crown"], StringComparer.Ordinal);
    public static readonly IReadOnlySet<string> Faces = new HashSet<string>(["mustache", "clownNose", "monocle", "eyePatch", "heroMask", "pixelShades"], StringComparer.Ordinal);
    public static readonly IReadOnlySet<string> Skins = new HashSet<string>(["rpgDrop", "pixel", "slime", "ghost", "rainbow", "arcadeGhost", "voxel", "synthwave", "galaxy", "neon", "realistic", "mecha", "hologram"], StringComparer.Ordinal);
    public static readonly IReadOnlySet<string> Trails = new HashSet<string>(["stars", "bubbles", "hearts", "slime", "rainbow", "pixels"], StringComparer.Ordinal);
    public static readonly IReadOnlySet<string> Animations = new HashSet<string>(["spring", "stopMotion", "spin", "levitation", "ninja", "teleport", "disco"], StringComparer.Ordinal);

    [JsonIgnore]
    public bool IsEmpty => Hat is null && Face is null && Skin is null && Trail is null && Animation is null;

    public CompanionOutfitModel Normalized() => new(
        Known(Hat, Hats),
        Known(Face, Faces),
        Known(Skin, Skins),
        Known(Trail, Trails),
        Known(Animation, Animations));

    private static string? Known(string? value, IReadOnlySet<string> allowed) => value is not null && allowed.Contains(value) ? value : null;
}

using System.Text.Json;
using Tily.Core.Appearance;
using Tily.Core.Session;
using Tily.Core.Settings;
using Xunit;

namespace Tily.Core.Tests.Appearance;

public sealed class CompanionOutfitModelTests
{
    private const string Project = @"C:\Files\Projects\tily";

    [Fact]
    public void Normalized_WhenAllKnown_ThenUnchanged()
    {
        var outfit = new CompanionOutfitModel("crown", "monocle", "galaxy", "stars", "spring");

        var normalized = outfit.Normalized();

        Assert.Equal(outfit, normalized);
    }

    [Fact]
    public void Normalized_WhenUnknownOrMiscased_ThenSlotCleared()
    {
        var outfit = new CompanionOutfitModel("sombrero", "Monocle", "neon", "confetti", "moonwalk");

        var normalized = outfit.Normalized();

        Assert.Equal(new CompanionOutfitModel(Skin: "neon"), normalized);
    }

    [Fact]
    public void WithProjectOutfit_WhenOutfitGiven_ThenStoredForProject()
    {
        var outfit = new CompanionOutfitModel(Hat: "cap", Trail: "hearts");

        var appearance = AppearanceSettingsModel.Default.WithProjectOutfit(Project, outfit);

        Assert.Equal(outfit, appearance.ProjectOutfits[Project.ToUpperInvariant()]);
    }

    [Fact]
    public void WithProjectOutfit_WhenOutfitEmptiedOrUnknown_ThenProjectRemoved()
    {
        var dressed = AppearanceSettingsModel.Default.WithProjectOutfit(Project, new CompanionOutfitModel(Hat: "cap"));

        var appearance = dressed.WithProjectOutfit(Project, new CompanionOutfitModel(Hat: "sombrero"));

        Assert.Empty(appearance.ProjectOutfits);
    }

    [Fact]
    public void Normalized_WhenProjectOutfitsInvalid_ThenOnlyKnownKept()
    {
        var appearance = AppearanceSettingsModel.Default with
        {
            ProjectOutfits = new(StringComparer.OrdinalIgnoreCase)
            {
                [Project] = new CompanionOutfitModel(Hat: "crown", Face: "sombrero"),
                [" "] = new CompanionOutfitModel(Hat: "cap"),
                [@"C:\Files\Projects\autre"] = new CompanionOutfitModel(Skin: "plaid")
            }
        };

        var normalized = appearance.Normalized();

        Assert.Equal([new KeyValuePair<string, CompanionOutfitModel>(Project, new CompanionOutfitModel(Hat: "crown"))], normalized.ProjectOutfits);
    }

    [Fact]
    public void Equals_WhenOutfitsDiffer_ThenNotEqual()
    {
        var first = AppearanceSettingsModel.Default.WithProjectOutfit(Project, new CompanionOutfitModel(Hat: "cap"));
        var second = AppearanceSettingsModel.Default.WithProjectOutfit(Project, new CompanionOutfitModel(Hat: "crown"));

        var equal = first.Equals(second);

        Assert.False(equal);
    }

    [Fact]
    public void Serialize_WhenOutfitWritten_ThenOnlySlotsStored()
    {
        var outfit = new CompanionOutfitModel(Hat: "crown");

        var json = JsonSerializer.Serialize(outfit, SessionRepository.JsonOptions);

        Assert.DoesNotContain("isEmpty", json, StringComparison.OrdinalIgnoreCase);
    }
}

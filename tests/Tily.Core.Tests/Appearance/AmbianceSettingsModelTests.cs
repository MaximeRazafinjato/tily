using Tily.Core.Appearance;
using Xunit;

namespace Tily.Core.Tests.Appearance;

public sealed class AmbianceSettingsModelTests
{
    [Fact]
    public void Normalized_WhenDefault_ThenUnchanged()
    {
        var normalized = AmbianceSettingsModel.Default.Normalized();

        Assert.Equal(AmbianceSettingsModel.Default, normalized);
    }

    [Fact]
    public void Normalized_WhenValuesOutOfRange_ThenClamped()
    {
        var settings = AmbianceSettingsModel.Default with
        {
            Gradient = AmbianceSettingsModel.Default.Gradient with { Angle = 720, Band = 10, Duration = 600 },
            Background = new AmbianceBackgroundModel(Opacity: 150),
            InterfaceVeil = -5,
            Terminal = new AmbianceTerminalModel(Veil: 300),
            Performance = new AmbiancePerformanceModel(ShaderQuality: 1, FpsLimit: 500)
        };

        var normalized = settings.Normalized();

        Assert.Equal(
            (360, 200, 60d, 100, 0, 100, 25, 60),
            (normalized.Gradient.Angle, normalized.Gradient.Band, normalized.Gradient.Duration, normalized.Background.Opacity, normalized.InterfaceVeil, normalized.Terminal.Veil, normalized.Performance.ShaderQuality, normalized.Performance.FpsLimit));
    }

    [Theory]
    [InlineData(2, AmbianceCompanionsModel.MinSize)]
    [InlineData(200, AmbianceCompanionsModel.MaxSize)]
    public void Normalized_WhenCompanionSizeOutOfRange_ThenClamped(int size, int expected)
    {
        var settings = AmbianceSettingsModel.Default with { Companions = new AmbianceCompanionsModel(true, size) };

        var normalized = settings.Normalized();

        Assert.Equal(new AmbianceCompanionsModel(true, expected), normalized.Companions);
    }

    [Fact]
    public void Normalized_WhenCompanionsMissing_ThenDefaultDisabled()
    {
        var settings = AmbianceSettingsModel.Default with { Companions = null! };

        var normalized = settings.Normalized();

        Assert.Equal(new AmbianceCompanionsModel(), normalized.Companions);
    }

    [Fact]
    public void Normalized_WhenColorsInvalid_ThenKeepsValidOnesLowercase()
    {
        var settings = AmbianceSettingsModel.Default with { Gradient = new AmbianceGradientModel(["#FF0000", "rouge", "#00f"]) };

        var normalized = settings.Normalized();

        Assert.Equal(["#ff0000", "#0000ff"], normalized.Gradient.Colors);
    }

    [Fact]
    public void Normalized_WhenFewerThanTwoValidColors_ThenDefaultColors()
    {
        var settings = AmbianceSettingsModel.Default with { Gradient = new AmbianceGradientModel(["#ff0000", "bleu"]) };

        var normalized = settings.Normalized();

        Assert.Equal(AmbiancePresets.Rainbow.Gradient.Colors, normalized.Gradient.Colors);
    }

    [Fact]
    public void Normalized_WhenUnknownEnumValues_ThenDefaults()
    {
        var settings = AmbianceSettingsModel.Default with
        {
            Gradient = AmbianceSettingsModel.Default.Gradient with { Type = (AmbianceGradientType)99 },
            Done = new AmbianceAlertModel(true, (AmbianceAlertEffect)99, "jaune")
        };

        var normalized = settings.Normalized();

        Assert.Equal((AmbianceGradientType.Linear, AmbianceSettingsModel.Default.Done), (normalized.Gradient.Type, normalized.Done));
    }

    [Fact]
    public void Normalized_WhenPresetsDuplicatedOrBuiltInNames_ThenRemoved()
    {
        var gradient = new AmbianceGradientModel(["#111111", "#222222"]);
        var settings = AmbianceSettingsModel.Default with
        {
            Presets = [new(" Soir ", gradient), new("soir", gradient), new("Néon", gradient), new("  ", gradient)]
        };

        var normalized = settings.Normalized();

        Assert.Equal([new AmbiancePresetModel("Soir", gradient)], normalized.Presets);
    }

    [Theory]
    [InlineData("  Fira Code ", "Fira Code")]
    [InlineData("Evil\"; font", null)]
    [InlineData("   ", null)]
    public void Normalized_WhenFontFamily_ThenTrimmedOrRejected(string fontFamily, string? expected)
    {
        var settings = AmbianceSettingsModel.Default with { Terminal = new AmbianceTerminalModel(FontFamily: fontFamily) };

        var normalized = settings.Normalized();

        Assert.Equal(expected, normalized.Terminal.FontFamily);
    }
}

using Tily.Core.Shortcuts;
using Xunit;

namespace Tily.Core.Tests.Shortcuts;

public sealed class ShortcutRulesTests
{
    [Fact]
    public void Resolve_WhenNothingProvided_ThenEveryCatalogCommandHasItsDefaults()
    {
        var settings = ShortcutRules.Resolve(null);

        Assert.All(ShortcutCatalog.Commands, command => Assert.Equal(new ShortcutBindingModel(command.Direct, command.Leader), settings.Bindings![command.Id]));
    }

    [Fact]
    public void Check_WhenDefaults_ThenAccepted()
    {
        var result = ShortcutRules.Check(ShortcutSettingsModel.Default);

        Assert.Null(result.Error);
    }

    [Fact]
    public void Check_WhenDirectChordMovedToAnotherCommand_ThenPreviousOwnerKeepsItsDefaultOnlyIfFree()
    {
        var provided = new ShortcutSettingsModel { Bindings = new() { ["newTab"] = new ShortcutBindingModel(Direct: "ctrl+shift+d"), ["splitSideBySide"] = new ShortcutBindingModel(Direct: "") } };

        var result = ShortcutRules.Check(provided);

        Assert.Equal((null, "Ctrl+Shift+D", ""), (result.Error, result.Settings.Bindings!["newTab"].Direct, result.Settings.Bindings["splitSideBySide"].Direct));
    }

    [Fact]
    public void Check_WhenTwoCommandsShareDirectChord_ThenRefusesInFrench()
    {
        var provided = new ShortcutSettingsModel { Bindings = new() { ["newTab"] = new ShortcutBindingModel(Direct: "Ctrl+Shift+D"), ["splitSideBySide"] = new ShortcutBindingModel(Direct: "Ctrl+Shift+D") } };

        var result = ShortcutRules.Check(provided);

        Assert.Equal("Ctrl + Maj + D est attribué à la fois à « newTab » et à « splitSideBySide ».", result.Error);
    }

    [Theory]
    [InlineData("Ctrl+C", "Ctrl + C est réservé au shell : Ctrl + lettre seule reste au terminal.")]
    [InlineData("Ctrl+Shift+V", "Ctrl + Maj + V est réservé : il colle dans le terminal.")]
    [InlineData("Alt+F4", "Alt + F4 est réservé : il ferme Tily.")]
    [InlineData("Shift+D", "Maj + D n’est pas utilisable : un raccourci direct passe par Ctrl ou Alt, sauf touche de fonction (F1 à F24) ou Maj + touche non imprimable.")]
    [InlineData("PageUp", "PgUp n’est pas utilisable : un raccourci direct passe par Ctrl ou Alt, sauf touche de fonction (F1 à F24) ou Maj + touche non imprimable.")]
    public void DirectProblem_WhenChordReserved_ThenExplainsWhy(string chord, string expected)
    {
        var problem = ShortcutRules.DirectProblem(chord);

        Assert.Equal(expected, problem);
    }

    [Theory]
    [InlineData("Ctrl+P")]
    [InlineData("Ctrl+Alt+K")]
    [InlineData("F5")]
    [InlineData("Shift+F2")]
    [InlineData("Shift+PageDown")]
    public void DirectProblem_WhenChordUsable_ThenNull(string chord)
    {
        var problem = ShortcutRules.DirectProblem(chord);

        Assert.Null(problem);
    }

    [Fact]
    public void Check_WhenLeaderKeySelectsTab_ThenRefuses()
    {
        var provided = new ShortcutSettingsModel { Bindings = new() { ["newTab"] = new ShortcutBindingModel(Leader: "3") } };

        var result = ShortcutRules.Check(provided);

        Assert.Equal("3 après le Leader est réservé : il affiche l’onglet 3.", result.Error);
    }

    [Fact]
    public void Check_WhenLeaderIsDirectChordOfCommand_ThenRefuses()
    {
        var provided = new ShortcutSettingsModel { Leader = "Ctrl+Alt+B", Bindings = new() { ["toggleSidebar"] = new ShortcutBindingModel(Direct: "Ctrl+Alt+B") } };

        var result = ShortcutRules.Check(provided);

        Assert.Equal("Ctrl + Alt + B est déjà la touche Leader.", result.Error);
    }

    [Fact]
    public void Check_WhenLeaderChanged_ThenDefaultDirectWithSameChordIsDropped()
    {
        var provided = new ShortcutSettingsModel { Leader = "Ctrl+Shift+T" };

        var result = ShortcutRules.Check(provided);

        Assert.Equal((null, ""), (result.Error, result.Settings.Bindings!["newTab"].Direct));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(61)]
    public void Check_WhenTimeoutOutOfRange_ThenRefuses(int seconds)
    {
        var result = ShortcutRules.Check(new ShortcutSettingsModel { LeaderTimeoutSeconds = seconds });

        Assert.Equal("Le délai du Leader doit être compris entre 1 et 60 secondes.", result.Error);
    }

    [Fact]
    public void Resolve_WhenOverridesInvalid_ThenFallsBackToDefaultsAndClampsTimeout()
    {
        var provided = new ShortcutSettingsModel { Leader = "Alt+F4", LeaderTimeoutSeconds = 500, Bindings = new() { ["newTab"] = new ShortcutBindingModel("Ctrl+T", "1"), ["inconnu"] = new ShortcutBindingModel("Ctrl+Shift+K") } };

        var settings = ShortcutRules.Resolve(provided);

        Assert.Equal((ShortcutCatalog.DefaultLeader, 60, new ShortcutBindingModel("Ctrl+Shift+T", "T"), false), (settings.Leader, settings.LeaderTimeoutSeconds, settings.Bindings!["newTab"], settings.Bindings.ContainsKey("inconnu")));
    }

    [Fact]
    public void Overrides_WhenOnlyOneCommandChanged_ThenKeepsOnlyItsChangedField()
    {
        var settings = ShortcutRules.Resolve(new ShortcutSettingsModel { Bindings = new() { ["openBrowser"] = new ShortcutBindingModel(Direct: "Ctrl+Shift+U") } });

        var overrides = ShortcutRules.Overrides(settings);

        Assert.Equal(new Dictionary<string, ShortcutBindingModel> { ["openBrowser"] = new("Ctrl+Shift+U") }, overrides.Bindings);
    }

    [Fact]
    public void InterceptedChords_WhenDefaults_ThenContainsLeaderDirectChordsAndCloseWindow()
    {
        var chords = ShortcutRules.InterceptedChords(ShortcutSettingsModel.Default);

        Assert.True(new[] { "Ctrl+Space", "Alt+F4", "Ctrl+P", "Ctrl+Shift+D", "Alt+PageUp", "Ctrl+Tab" }.All(chords.Contains));
    }
}

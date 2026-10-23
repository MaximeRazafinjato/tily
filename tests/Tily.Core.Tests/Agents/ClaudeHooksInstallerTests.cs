using System.Text.Json.Nodes;
using Tily.Core.Agents;
using Xunit;

namespace Tily.Core.Tests.Agents;

public sealed class ClaudeHooksInstallerTests : IDisposable
{
    private const string Script = @"C:\Tily\hooks\tily-agent-state.ps1";

    private readonly string _directory = Path.Combine(Path.GetTempPath(), "tily-tests-" + Guid.NewGuid().ToString("N"));
    private readonly string _file;
    private readonly ClaudeHooksInstaller _installer;

    public ClaudeHooksInstallerTests()
    {
        _file = Path.Combine(_directory, ".claude", "settings.json");
        _installer = new ClaudeHooksInstaller(Script, _file);
    }

    [Fact]
    public void Install_WhenFileMissing_ThenCreatesEveryEvent()
    {
        var status = _installer.Install();

        var hooks = JsonNode.Parse(File.ReadAllText(_file))!["hooks"]!.AsObject();
        Assert.True(status.Installed);
        Assert.Equal(ClaudeHooksInstaller.Events, hooks.Select(pair => pair.Key).ToList());
        Assert.Equal(Script, hooks["Stop"]![0]!["hooks"]![0]!["args"]![4]!.GetValue<string>());
        Assert.Equal("AskUserQuestion", hooks["PreToolUse"]![0]!["matcher"]!.GetValue<string>());
        Assert.Null(hooks["Stop"]![0]!["matcher"]);
    }

    [Fact]
    public void Install_WhenFileMissing_ThenAddsBashGroupFilteredOnStart()
    {
        _installer.Install();

        var bash = JsonNode.Parse(File.ReadAllText(_file))!["hooks"]!["PreToolUse"]![1]!;
        Assert.Equal("Bash", bash["matcher"]!.GetValue<string>());
        Assert.Equal(ClaudeHooksInstaller.PreviewCommandCondition, bash["hooks"]![0]!["if"]!.GetValue<string>());
    }

    [Fact]
    public void Status_WhenInstalledWithoutBashGroup_ThenFalse()
    {
        _installer.Install();
        var root = JsonNode.Parse(File.ReadAllText(_file))!;
        root["hooks"]!["PreToolUse"]!.AsArray().RemoveAt(1);
        File.WriteAllText(_file, root.ToJsonString());

        var status = _installer.Status();

        Assert.False(status.Installed);
    }

    [Fact]
    public void Install_WhenOtherSettingsExist_ThenPreservesThemAndForeignHooks()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(_file)!);
        File.WriteAllText(_file, "{ \"model\": \"opus\", \"hooks\": { \"Stop\": [ { \"hooks\": [ { \"type\": \"command\", \"command\": \"echo fin\" } ] } ] } }");

        _installer.Install();
        _installer.Install();

        var root = JsonNode.Parse(File.ReadAllText(_file))!;
        var stop = root["hooks"]!["Stop"]!.AsArray();
        Assert.Equal("opus", root["model"]!.GetValue<string>());
        Assert.Equal(2, stop.Count);
        Assert.Equal("echo fin", stop[0]!["hooks"]![0]!["command"]!.GetValue<string>());
    }

    [Fact]
    public void Status_WhenNotInstalled_ThenFalse()
    {
        var status = _installer.Status();

        Assert.False(status.Installed);
        Assert.Equal(_file, status.SettingsFile);
    }

    [Fact]
    public void Remove_WhenInstalledNextToForeignHooks_ThenKeepsOnlyForeignOnes()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(_file)!);
        File.WriteAllText(_file, "{ \"model\": \"opus\", \"hooks\": { \"Stop\": [ { \"hooks\": [ { \"type\": \"command\", \"command\": \"echo fin\" } ] } ] } }");
        _installer.Install();

        var status = _installer.Remove();

        var root = JsonNode.Parse(File.ReadAllText(_file))!;
        Assert.False(status.Installed);
        Assert.Equal("opus", root["model"]!.GetValue<string>());
        Assert.Equal(["Stop"], root["hooks"]!.AsObject().Select(pair => pair.Key).ToList());
        Assert.False(_installer.Status().Installed);
    }

    [Fact]
    public void Remove_WhenOnlyTilyHooks_ThenDropsHooksKey()
    {
        _installer.Install();

        _installer.Remove();

        Assert.Null(JsonNode.Parse(File.ReadAllText(_file))!["hooks"]);
    }

    [Fact]
    public void RemoveIfPresent_WhenNoTilyHooks_ThenLeavesFileUntouched()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(_file)!);
        const string content = "{ // réglages\n  \"model\": \"opus\" }";
        File.WriteAllText(_file, content);

        var removed = _installer.RemoveIfPresent();

        Assert.False(removed);
        Assert.Equal(content, File.ReadAllText(_file));
    }

    [Fact]
    public void RemoveIfPresent_WhenTilyHooksInstalled_ThenRemovesThem()
    {
        _installer.Install();

        var removed = _installer.RemoveIfPresent();

        Assert.True(removed);
        Assert.Null(JsonNode.Parse(File.ReadAllText(_file))!["hooks"]);
    }

    [Fact]
    public void Install_WhenFileInvalid_ThenThrowsFrenchMessage()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(_file)!);
        File.WriteAllText(_file, "{ oops");

        var exception = Assert.Throws<InvalidOperationException>(() => _installer.Install());

        Assert.StartsWith($"Le fichier {_file} est illisible", exception.Message);
    }

    [Fact]
    public void RepointIfMissing_WhenDeclaredScriptDeleted_ThenPointsToThisCopy()
    {
        var script = CreateScript("Tily Beta");
        new ClaudeHooksInstaller(Path.Combine(_directory, "Supprimé", "hooks", "tily-agent-state.ps1"), _file).Install();

        var repointed = new ClaudeHooksInstaller(script, _file).RepointIfMissing();

        Assert.True(repointed);
        Assert.Equal(script, DeclaredScript());
    }

    [Fact]
    public void RepointIfMissing_WhenDeclaredScriptExists_ThenKeepsIt()
    {
        var declared = CreateScript("Tily");
        new ClaudeHooksInstaller(declared, _file).Install();

        var repointed = new ClaudeHooksInstaller(CreateScript("Tily Beta"), _file).RepointIfMissing();

        Assert.False(repointed);
        Assert.Equal(declared, DeclaredScript());
    }

    [Fact]
    public void RepointIfMissing_WhenNoTilyHooks_ThenInstallsNothing()
    {
        var repointed = new ClaudeHooksInstaller(CreateScript("Tily"), _file).RepointIfMissing();

        Assert.False(repointed);
        Assert.False(File.Exists(_file));
    }

    private string DeclaredScript() =>
        JsonNode.Parse(File.ReadAllText(_file))!["hooks"]!["Stop"]![0]!["hooks"]![0]!["args"]![4]!.GetValue<string>();

    private string CreateScript(string folder)
    {
        var path = Path.Combine(_directory, folder, "hooks", "tily-agent-state.ps1");
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, string.Empty);
        return path;
    }

    public void Dispose()
    {
        if (Directory.Exists(_directory))
        {
            Directory.Delete(_directory, true);
        }
    }
}

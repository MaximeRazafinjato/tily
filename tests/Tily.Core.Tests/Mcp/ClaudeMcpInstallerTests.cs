using System.Text.Json.Nodes;
using Tily.Core.Mcp;
using Xunit;

namespace Tily.Core.Tests.Mcp;

public sealed class ClaudeMcpInstallerTests : IDisposable
{
    private const string Executable = @"C:\Tily\tily-mcp.exe";
    private const string ForeignServer = """{ "mcpServers": { "tily": { "command": "autre.exe" } } }""";

    private readonly string _directory = Path.Combine(Path.GetTempPath(), "tily-tests-" + Guid.NewGuid().ToString("N"));
    private readonly string _file;
    private readonly ClaudeMcpInstaller _installer;

    public ClaudeMcpInstallerTests()
    {
        _file = Path.Combine(_directory, ".claude.json");
        _installer = new ClaudeMcpInstaller(Executable, _file);
    }

    [Fact]
    public void Install_WhenFileMissing_ThenDeclaresStdioServer()
    {
        var status = _installer.Install();

        var server = JsonNode.Parse(File.ReadAllText(_file))!["mcpServers"]!["tily"]!;
        Assert.True(status.Installed);
        Assert.Equal("stdio", server["type"]!.GetValue<string>());
        Assert.Equal(Executable, server["command"]!.GetValue<string>());
    }

    [Fact]
    public void Install_WhenOtherKeysAndServersExist_ThenPreservesThem()
    {
        Write("""{ "numStartups": 42, "projects": { "C:/x": { "allowedTools": [] } }, "mcpServers": { "gitlab": { "command": "gitlab-mcp" } } }""");

        _installer.Install();

        var root = JsonNode.Parse(File.ReadAllText(_file))!;
        Assert.Equal(42, root["numStartups"]!.GetValue<int>());
        Assert.NotNull(root["projects"]!["C:/x"]);
        Assert.Equal("gitlab-mcp", root["mcpServers"]!["gitlab"]!["command"]!.GetValue<string>());
    }

    [Fact]
    public void Install_WhenForeignServerNamedTily_ThenRefusesWithoutWriting()
    {
        Write(ForeignServer);

        var error = Assert.Throws<InvalidOperationException>(() => _installer.Install());

        Assert.Contains("n’est pas celui de Tily", error.Message);
        Assert.Equal(ForeignServer, File.ReadAllText(_file));
    }

    [Fact]
    public void Install_WhenDeclaredForAnotherCopy_ThenReplacesCommand()
    {
        Write("""{ "mcpServers": { "tily": { "command": "D:\\Dev\\tily-mcp.exe" } } }""");

        _installer.Install();

        Assert.Equal(Executable, _installer.Status().Command);
    }

    [Fact]
    public void Status_WhenDeclaredForAnotherCopy_ThenInstalledWithItsCommand()
    {
        Write("""{ "mcpServers": { "tily": { "command": "D:\\Dev\\TILY-MCP.EXE" } } }""");

        var status = _installer.Status();

        Assert.True(status.Installed);
        Assert.Equal(@"D:\Dev\TILY-MCP.EXE", status.Command);
    }

    [Fact]
    public void Status_WhenFileMissing_ThenNotInstalled()
    {
        var status = _installer.Status();

        Assert.False(status.Installed);
        Assert.Equal(_file, status.ConfigFile);
    }

    [Fact]
    public void Remove_WhenInstalled_ThenKeepsOtherServers()
    {
        Write("""{ "mcpServers": { "gitlab": { "command": "gitlab-mcp" } } }""");
        _installer.Install();

        _installer.Remove();

        var servers = JsonNode.Parse(File.ReadAllText(_file))!["mcpServers"]!.AsObject();
        Assert.Equal(["gitlab"], servers.Select(pair => pair.Key).ToList());
    }

    [Fact]
    public void RemoveIfPresent_WhenForeignServerNamedTily_ThenLeavesFileUntouched()
    {
        Write(ForeignServer);

        var removed = _installer.RemoveIfPresent();

        Assert.False(removed);
        Assert.Equal(ForeignServer, File.ReadAllText(_file));
    }

    [Fact]
    public void Status_WhenFileUnreadable_ThenFailsInFrench()
    {
        Write("{ pas du json");

        var error = Assert.Throws<InvalidOperationException>(() => _installer.Status());

        Assert.Contains("est illisible", error.Message);
    }

    [Fact]
    public void RepointIfMissing_WhenDeclaredCopyDeleted_ThenDeclaresThisCopy()
    {
        var executable = CreateExecutable("Tily Beta");
        Write(Declaration(Path.Combine(_directory, "Supprimé", ClaudeMcpInstaller.ExecutableName)));

        var repointed = new ClaudeMcpInstaller(executable, _file).RepointIfMissing();

        Assert.True(repointed);
        Assert.Equal(executable, JsonNode.Parse(File.ReadAllText(_file))!["mcpServers"]!["tily"]!["command"]!.GetValue<string>());
    }

    [Fact]
    public void RepointIfMissing_WhenDeclaredCopyExists_ThenKeepsIt()
    {
        var declared = CreateExecutable("Tily");
        Write(Declaration(declared));

        var repointed = new ClaudeMcpInstaller(CreateExecutable("Tily Beta"), _file).RepointIfMissing();

        Assert.False(repointed);
        Assert.Equal(declared, JsonNode.Parse(File.ReadAllText(_file))!["mcpServers"]!["tily"]!["command"]!.GetValue<string>());
    }

    private static string Declaration(string command) =>
        new JsonObject { ["mcpServers"] = new JsonObject { ["tily"] = new JsonObject { ["command"] = command } } }.ToJsonString();

    private string CreateExecutable(string folder)
    {
        var path = Path.Combine(_directory, folder, ClaudeMcpInstaller.ExecutableName);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, string.Empty);
        return path;
    }

    private void Write(string content)
    {
        Directory.CreateDirectory(_directory);
        File.WriteAllText(_file, content);
    }

    public void Dispose()
    {
        if (Directory.Exists(_directory))
        {
            Directory.Delete(_directory, true);
        }
    }
}

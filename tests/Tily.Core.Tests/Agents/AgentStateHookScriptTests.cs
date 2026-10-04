using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Xunit;

namespace Tily.Core.Tests.Agents;

public sealed class AgentStateHookScriptTests : IDisposable
{
    private const string PaneId = "pane-hook";

    private readonly string _directory = Path.Combine(Path.GetTempPath(), "tily-tests-" + Guid.NewGuid().ToString("N"));

    [Fact]
    public void Run_WhenBashPermissionRequested_ThenWritesCommandAsDetail()
    {
        var state = Run("{ \"hook_event_name\": \"PermissionRequest\", \"tool_name\": \"Bash\", \"tool_input\": { \"command\": \"git push --force origin main\", \"description\": \"Pousser\" } }");

        Assert.Equal("Autorisation demandée : Bash", state["message"]!.GetValue<string>());
        Assert.Equal("git push --force origin main", state["detail"]!.GetValue<string>());
    }

    [Fact]
    public void Run_WhenQuestionAsked_ThenWritesFirstQuestionWithAccents()
    {
        var state = Run("{ \"hook_event_name\": \"PreToolUse\", \"tool_name\": \"AskUserQuestion\", \"tool_input\": { \"questions\": [ { \"question\": \"Quelle stratégie adopter à l’étape 2 ?\" } ] } }");

        Assert.Equal("Quelle stratégie adopter à l’étape 2 ?", state["detail"]!.GetValue<string>());
    }

    [Fact]
    public void Run_WhenUnknownToolPermissionRequested_ThenWritesInputAsJson()
    {
        var state = Run("{ \"hook_event_name\": \"PermissionRequest\", \"tool_name\": \"mcp__jira__create\", \"tool_input\": { \"summary\": \"Bug\" } }");

        Assert.Equal("{\"summary\":\"Bug\"}", state["detail"]!.GetValue<string>());
    }

    [Fact]
    public void Run_WhenStopped_ThenWritesLastAssistantTextFromTranscript()
    {
        Directory.CreateDirectory(_directory);
        var transcript = Path.Combine(_directory, "session.jsonl");
        File.WriteAllLines(transcript,
        [
            "{\"type\":\"user\",\"message\":{\"role\":\"user\",\"content\":\"Corrige le bug\"}}",
            "{\"isSidechain\":false,\"message\":{\"role\":\"assistant\",\"content\":[{\"type\":\"text\",\"text\":\"Le bug est corrigé et testé.\"}]},\"type\":\"assistant\"}",
            "{\"isSidechain\":true,\"message\":{\"role\":\"assistant\",\"content\":[{\"type\":\"text\",\"text\":\"Sous-agent\"}]},\"type\":\"assistant\"}",
            "{\"isSidechain\":false,\"message\":{\"role\":\"assistant\",\"content\":[{\"type\":\"tool_use\",\"name\":\"Bash\"}]},\"type\":\"assistant\"}"
        ], new UTF8Encoding(false));

        var state = Run(JsonSerializer.Serialize(new Dictionary<string, string> { ["hook_event_name"] = "Stop", ["transcript_path"] = transcript }));

        Assert.Equal("done", state["state"]!.GetValue<string>());
        Assert.Equal("Le bug est corrigé et testé.", state["detail"]!.GetValue<string>());
    }

    [Fact]
    public void Run_WhenStoppedWithLastAssistantMessage_ThenPrefersIt()
    {
        var state = Run("{ \"hook_event_name\": \"Stop\", \"last_assistant_message\": \"Terminé : 3 fichiers modifiés.\", \"transcript_path\": \"C:\\\\absent.jsonl\" }");

        Assert.Equal("Terminé : 3 fichiers modifiés.", state["detail"]!.GetValue<string>());
    }

    [Fact]
    public void Run_WhenClaudeStartsHtmlWithBashPath_ThenRequestsPreviewAndDeniesCommand()
    {
        var page = Page("plan de relecture.html");
        var bashPath = "/" + char.ToLowerInvariant(page[0]) + page[2..].Replace('\\', '/');

        var output = Execute(StartPayload($"start \"\" \"{bashPath}\"", @"C:\Windows"));

        Assert.Equal("deny", JsonNode.Parse(output)!["hookSpecificOutput"]!["permissionDecision"]!.GetValue<string>());
        Assert.Equal(page, RequestedPaths().Single());
    }

    [Fact]
    public void Run_WhenClaudeStartsRelativeHtml_ThenResolvesItFromWorkingDirectory()
    {
        var page = Page("plan.html");

        Execute(StartPayload("start plan.html", _directory));

        Assert.Equal(page, RequestedPaths().Single());
    }

    [Theory]
    [InlineData("start \"\" \"rapport.pdf\"")]
    [InlineData("start \"\" \"absent.html\"")]
    [InlineData("echo \"start plan.html\"")]
    [InlineData("git status # ; start plan.html")]
    [InlineData("cat > notes.md <<'EOF'\nstart plan.html\nEOF")]
    public void Run_WhenCommandOpensNoPageToPreview_ThenLetsItRun(string command)
    {
        Page("plan.html");
        Page("rapport.pdf");

        var output = Execute(StartPayload(command, _directory));

        Assert.Equal((string.Empty, 0), (output, RequestedPaths().Count));
    }

    [Fact]
    public void Run_WhenCompoundCommandStartsHtmlAfterCd_ThenPreviewsItFromThatFolder()
    {
        var page = Page(Path.Combine("Projet Terminal", "b.html"));

        var output = Execute(StartPayload("cd \"Projet Terminal\" && git check-ignore -q x ; start \"\" \"b.html\"", _directory));

        Assert.Equal(page, RequestedPaths().Single());
        Assert.EndsWith("relance le reste de la commande sans ce `start`.", Reason(output));
    }

    [Theory]
    [InlineData("git status ; start \"\" \"{page}\"")]
    [InlineData("start \"\" \"plan.html\" && echo ok")]
    [InlineData("echo ok 2>&1 || start plan.html")]
    [InlineData("cat > notes.md <<-EOF\n\tstart rapport.html\n\tEOF\nstart plan.html")]
    public void Run_WhenCompoundCommandStartsExistingHtml_ThenPreviewsItAndDeniesCommand(string command)
    {
        var page = Page("plan.html");

        var output = Execute(StartPayload(command.Replace("{page}", page.Replace('\\', '/')), _directory));

        Assert.Equal(page, RequestedPaths().Single());
        Assert.Equal("deny", JsonNode.Parse(output)!["hookSpecificOutput"]!["permissionDecision"]!.GetValue<string>());
    }

    [Fact]
    public void Run_WhenCompoundCommandStartsHtmlNotYetGenerated_ThenDeniesWithStandaloneStartToRun()
    {
        var page = Path.Combine(_directory, "rapport.html");

        var output = Execute(StartPayload("node build.js && start \"\" \"rapport.html\"", _directory));

        Assert.Empty(RequestedPaths());
        Assert.Contains($"puis lance `start \"\" \"{page}\"` seul", Reason(output));
    }

    private string Page(string name)
    {
        var path = Path.Combine(_directory, name);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, "<h1>Plan</h1>");
        return path;
    }

    private static string StartPayload(string command, string workingDirectory) =>
        JsonSerializer.Serialize(new { hook_event_name = "PreToolUse", tool_name = "Bash", cwd = workingDirectory, tool_input = new { command } });

    private static string Reason(string output) =>
        JsonNode.Parse(output)!["hookSpecificOutput"]!["permissionDecisionReason"]!.GetValue<string>();

    private List<string> RequestedPaths()
    {
        var requests = Path.Combine(_directory, "previews");
        return Directory.Exists(requests)
            ? Directory.EnumerateFiles(requests, "*.json").Select(file => JsonNode.Parse(File.ReadAllText(file, Encoding.UTF8))!["path"]!.GetValue<string>()).ToList()
            : [];
    }

    private JsonNode Run(string payload)
    {
        Execute(payload);
        return JsonNode.Parse(File.ReadAllText(Path.Combine(_directory, "agents", PaneId + ".json"), Encoding.UTF8))!;
    }

    private string Execute(string payload)
    {
        var start = new ProcessStartInfo("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ScriptPath()])
        {
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            StandardInputEncoding = new UTF8Encoding(false),
            StandardOutputEncoding = new UTF8Encoding(false)
        };
        start.Environment["TILY_PANE_ID"] = PaneId;
        start.Environment["TILY_DATA_DIR"] = _directory;

        using var process = Process.Start(start)!;
        process.StandardInput.Write(payload);
        process.StandardInput.Close();
        var output = process.StandardOutput.ReadToEnd();
        Assert.True(process.WaitForExit(TimeSpan.FromSeconds(30)), "Le script du hook n’a pas terminé dans le délai.");

        return output;
    }

    private static string ScriptPath()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "Tily.slnx")))
        {
            directory = directory.Parent;
        }

        return Path.Combine(directory?.FullName ?? throw new InvalidOperationException("Racine du dépôt introuvable."), "src", "Tily.Host", "hooks", "tily-agent-state.ps1");
    }

    public void Dispose()
    {
        if (Directory.Exists(_directory))
        {
            Directory.Delete(_directory, true);
        }
    }
}

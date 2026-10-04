using Tily.Core.Browser;
using Xunit;

namespace Tily.Core.Tests.Browser;

public sealed class DevToolsConsoleTests
{
    [Fact]
    public void Parse_WhenConsoleLogWithObjectAndArray_ThenPreviewsFormatted()
    {
        const string json = """
            {"type":"log","args":[
              {"type":"string","value":"page chargée"},
              {"type":"number","value":42,"description":"42"},
              {"type":"object","className":"Object","description":"Object","preview":{"type":"object","overflow":false,"properties":[{"name":"a","type":"number","value":"1"},{"name":"b","type":"string","value":"deux"}]}},
              {"type":"object","subtype":"array","className":"Array","description":"Array(3)","preview":{"type":"object","subtype":"array","overflow":false,"properties":[{"name":"0","type":"number","value":"1"},{"name":"1","type":"number","value":"2"},{"name":"2","type":"number","value":"3"}]}}
            ],"stackTrace":{"callFrames":[{"url":"http://localhost:5871/","lineNumber":22}]}}
            """;

        var message = DevToolsConsole.Parse(DevToolsConsole.ConsoleApiCalled, json);

        Assert.Equal(new BrowserConsoleMessageModel(BrowserLogLevel.Log, "page chargée 42 {a: 1, b: \"deux\"} [1, 2, 3]", "http://localhost:5871/", 23), message);
    }

    [Fact]
    public void Parse_WhenFormatString_ThenPlaceholdersSubstitutedAndCssDropped()
    {
        const string json = """
            {"type":"info","args":[
              {"type":"string","value":"%cinfo %s vaut %d %%"},
              {"type":"string","value":"color: red"},
              {"type":"string","value":"x"},
              {"type":"number","value":7,"description":"7"}
            ]}
            """;

        var message = DevToolsConsole.Parse(DevToolsConsole.ConsoleApiCalled, json);

        Assert.Equal("info x vaut 7 %", message?.Text);
    }

    [Theory]
    [InlineData("error", BrowserLogLevel.Error)]
    [InlineData("assert", BrowserLogLevel.Error)]
    [InlineData("warning", BrowserLogLevel.Warn)]
    [InlineData("debug", BrowserLogLevel.Debug)]
    [InlineData("table", BrowserLogLevel.Log)]
    public void LevelOfConsoleType_WhenType_ThenLevel(string type, BrowserLogLevel expected)
    {
        var level = DevToolsConsole.LevelOfConsoleType(type);

        Assert.Equal(expected, level);
    }

    [Fact]
    public void Parse_WhenUncaughtException_ThenErrorWithDescription()
    {
        const string json = """
            {"timestamp":1,"exceptionDetails":{"exceptionId":1,"text":"Uncaught","lineNumber":26,"columnNumber":20,"url":"http://localhost:5871/",
              "exception":{"type":"object","subtype":"error","className":"ReferenceError","description":"ReferenceError: undefinedFunction is not defined\n    at http://localhost:5871/:27:20"}}}
            """;

        var message = DevToolsConsole.Parse(DevToolsConsole.ExceptionThrown, json);

        Assert.Equal(new BrowserConsoleMessageModel(BrowserLogLevel.Error, "Uncaught ReferenceError: undefinedFunction is not defined\n    at http://localhost:5871/:27:20", "http://localhost:5871/", 27), message);
    }

    [Fact]
    public void Parse_WhenNetworkLogEntry_ThenIgnored()
    {
        const string json = """{"entry":{"source":"network","level":"error","text":"Failed to load resource: the server responded with a status of 404 (Not Found)","url":"http://localhost:5871/favicon.ico"}}""";

        var message = DevToolsConsole.Parse(DevToolsConsole.EntryAdded, json);

        Assert.Null(message);
    }

    [Fact]
    public void Parse_WhenSecurityLogEntry_ThenKeptWithLevel()
    {
        const string json = """{"entry":{"source":"security","level":"warning","text":"Mixed Content","url":"https://example.com/","lineNumber":0}}""";

        var message = DevToolsConsole.Parse(DevToolsConsole.EntryAdded, json);

        Assert.Equal(new BrowserConsoleMessageModel(BrowserLogLevel.Warn, "Mixed Content", "https://example.com/", 1), message);
    }

    [Fact]
    public void Parse_WhenEndGroup_ThenIgnored()
    {
        var message = DevToolsConsole.Parse(DevToolsConsole.ConsoleApiCalled, """{"type":"endGroup","args":[]}""");

        Assert.Null(message);
    }

    [Theory]
    [InlineData("""{"type":"undefined"}""", "undefined")]
    [InlineData("""{"type":"object","subtype":"null","value":null}""", "null")]
    [InlineData("""{"type":"number","unserializableValue":"NaN","description":"NaN"}""", "NaN")]
    [InlineData("""{"type":"boolean","value":true}""", "true")]
    [InlineData("""{"type":"function","className":"Function","description":"() => 1"}""", "() => 1")]
    [InlineData("""{"type":"object","subtype":"error","className":"Error","description":"Error: boum\n    at x","preview":{"type":"object","properties":[]}}""", "Error: boum\n    at x")]
    public void Describe_WhenRemoteObject_ThenReadableText(string json, string expected)
    {
        using var document = System.Text.Json.JsonDocument.Parse(json);

        var text = DevToolsConsole.Describe(document.RootElement);

        Assert.Equal(expected, text);
    }
}

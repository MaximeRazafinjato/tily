using System.Text.Json;
using Tily.Core.Browser;
using Xunit;

namespace Tily.Core.Tests.Browser;

public sealed class BrowserPageResultsTests
{
    [Fact]
    public void Parse_WhenPoint_ThenModel()
    {
        var point = BrowserPageResults.Parse<BrowserPointModel>("""{"result":{"type":"object","value":{"x":40,"y":12,"description":"button \"OK\"","matches":1}}}""");

        Assert.Equal(new BrowserPointModel(40, 12, "button \"OK\"", 1), point);
    }

    [Fact]
    public void Value_WhenPageRefuses_ThenFailsWithPageMessage()
    {
        var error = Assert.Throws<InvalidOperationException>(() => BrowserPageResults.Value("""{"result":{"type":"object","value":{"error":"Aucun élément affiché ne contient le texte « OK »."}}}"""));

        Assert.Equal("Aucun élément affiché ne contient le texte « OK ».", error.Message);
    }

    [Fact]
    public void Value_WhenScriptThrows_ThenFailsInFrenchWithDescription()
    {
        var error = Assert.Throws<InvalidOperationException>(() => BrowserPageResults.Value("""{"result":{"type":"object"},"exceptionDetails":{"text":"Uncaught","exception":{"description":"TypeError: boom"}}}"""));

        Assert.Equal("Le script de Tily a échoué dans la page : TypeError: boom", error.Message);
    }

    [Fact]
    public void Value_WhenNotAnObject_ThenFailsInFrench()
    {
        var error = Assert.Throws<InvalidOperationException>(() => BrowserPageResults.Value("""{"result":{"type":"undefined"}}"""));

        Assert.StartsWith("La page n’a pas rendu de réponse lisible", error.Message);
    }

    [Fact]
    public void Evaluation_WhenValue_ThenTypeAndValue()
    {
        var evaluation = BrowserPageResults.Evaluation("""{"result":{"type":"object","value":{"count":3}}}""");

        Assert.Equal(("object", 3, false), (evaluation.Type, evaluation.Value?.GetProperty("count").GetInt32(), evaluation.Truncated));
    }

    [Fact]
    public void Evaluation_WhenValueTooLong_ThenTruncatedText()
    {
        var evaluation = BrowserPageResults.Evaluation(JsonSerializer.Serialize(new { result = new { type = "string", value = new string('a', BrowserPageResults.MaxEvaluationLength) } }));

        Assert.Equal((true, BrowserPageResults.MaxEvaluationLength, false), (evaluation.Truncated, evaluation.Text?.Length, evaluation.Value.HasValue));
    }

    [Fact]
    public void Evaluation_WhenUnserializable_ThenText()
    {
        var evaluation = BrowserPageResults.Evaluation("""{"result":{"type":"number","unserializableValue":"NaN","description":"NaN"}}""");

        Assert.Equal(("number", "NaN"), (evaluation.Type, evaluation.Text));
    }

    [Fact]
    public void Evaluation_WhenUndefined_ThenTypeOnly()
    {
        var evaluation = BrowserPageResults.Evaluation("""{"result":{"type":"undefined"}}""");

        Assert.Equal(("undefined", (string?)null, false), (evaluation.Type, evaluation.Text, evaluation.Value.HasValue));
    }

    [Fact]
    public void Evaluation_WhenExpressionThrows_ThenFailsInFrench()
    {
        var error = Assert.Throws<InvalidOperationException>(() => BrowserPageResults.Evaluation("""{"result":{"type":"object"},"exceptionDetails":{"text":"Uncaught","exception":{"description":"ReferenceError: x is not defined"}}}"""));

        Assert.Equal("L’expression a levé une exception : ReferenceError: x is not defined", error.Message);
    }
}

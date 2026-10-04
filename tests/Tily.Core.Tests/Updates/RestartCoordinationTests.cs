using Tily.Core.Updates;
using Xunit;

namespace Tily.Core.Tests.Updates;

public sealed class RestartCoordinationTests : IDisposable
{
    private const string First = "2900f708077a49ca9ce94df5c379068d";
    private const string Second = "431949d1ff21481680f58fb4fbcdc05c";
    private readonly string _directory = Path.Combine(Path.GetTempPath(), "tily-tests-" + Guid.NewGuid().ToString("N"));
    private readonly RestartCoordination _coordination;

    public RestartCoordinationTests()
    {
        _coordination = new RestartCoordination(_directory);
    }

    [Fact]
    public void Request_ThenOpenRequests_ListsItForEveryWindow()
    {
        var request = _coordination.Request(First, "2.2.0");

        var open = new RestartCoordination(_directory).OpenRequests(DateTime.UtcNow.AddMinutes(-2));

        Assert.Equal(request, Assert.Single(open));
    }

    [Fact]
    public void OpenRequests_WhenRequestOlderThanTheWait_ThenIgnoresIt()
    {
        var request = _coordination.Request(First, "2.2.0");
        File.SetLastWriteTimeUtc(Path.Combine(_coordination.Directory, request.Id + ".request.json"), DateTime.UtcNow.AddMinutes(-10));

        var open = _coordination.OpenRequests(DateTime.UtcNow.AddMinutes(-2));

        Assert.Empty(open);
    }

    [Fact]
    public void Answer_ThenAnswers_KeepsEachWindowAnswerAndProcess()
    {
        var request = _coordination.Request(First, "2.2.0");

        _coordination.Answer(request.Id, Second, true, 5150);

        Assert.Equal(new RestartAnswerModel(Second, true, 5150), Assert.Single(_coordination.Answers(request.Id)));
    }

    [Fact]
    public void Decide_WhenRequestDecided_ThenNoLongerOpen()
    {
        var request = _coordination.Request(First, "2.2.0");

        _coordination.Decide(request.Id, false);

        Assert.Empty(_coordination.OpenRequests(DateTime.UtcNow.AddMinutes(-2)));
        Assert.False(_coordination.Decision(request.Id)!.Go);
    }

    [Fact]
    public void Answers_WhenAnotherRequestWasAnswered_ThenIgnoresIt()
    {
        var current = _coordination.Request(First, "2.2.0");
        var older = _coordination.Request(First, "2.1.9");
        _coordination.Answer(older.Id, Second, false, 5150);

        var answers = _coordination.Answers(current.Id);

        Assert.Empty(answers);
    }

    [Fact]
    public void Outcome_WhenEveryOtherWindowAccepted_ThenAccepted()
    {
        var request = _coordination.Request(First, "2.2.0");
        _coordination.Answer(request.Id, Second, true, 5150);

        var outcome = _coordination.Outcome(request.Id, [Second], _ => true, false);

        Assert.Equal(RestartOutcome.Accepted, outcome);
    }

    [Fact]
    public void Outcome_WhenOneWindowRefused_ThenRefusedEvenIfOthersWait()
    {
        const string third = "7155a2d691224aa88e3011ead39f91ee";
        var request = _coordination.Request(First, "2.2.0");
        _coordination.Answer(request.Id, Second, false, 5150);

        var outcome = _coordination.Outcome(request.Id, [Second, third], _ => true, false);

        Assert.Equal(RestartOutcome.Refused, outcome);
    }

    [Fact]
    public void Outcome_WhenAWindowClosedWithoutAnswering_ThenCountsAsAccepted()
    {
        var request = _coordination.Request(First, "2.2.0");

        var outcome = _coordination.Outcome(request.Id, [Second], _ => false, false);

        Assert.Equal(RestartOutcome.Accepted, outcome);
    }

    [Theory]
    [InlineData(false, RestartOutcome.Waiting)]
    [InlineData(true, RestartOutcome.Silent)]
    public void Outcome_WhenAnOpenWindowHasNotAnswered_ThenWaitsUntilTheDeadline(bool expired, RestartOutcome expected)
    {
        var request = _coordination.Request(First, "2.2.0");

        var outcome = _coordination.Outcome(request.Id, [Second], _ => true, expired);

        Assert.Equal(expected, outcome);
    }

    [Fact]
    public void Clear_WhenFilesLeftFromAnUpdate_ThenRemovesThem()
    {
        var request = _coordination.Request(First, "2.2.0");
        _coordination.Answer(request.Id, Second, true, 5150);

        _coordination.Clear();

        Assert.Empty(Directory.EnumerateFiles(_coordination.Directory));
    }

    public void Dispose()
    {
        if (Directory.Exists(_directory))
        {
            Directory.Delete(_directory, true);
        }
    }
}

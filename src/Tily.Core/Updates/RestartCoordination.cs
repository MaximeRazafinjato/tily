using System.Text.Json;
using Tily.Core.Session;

namespace Tily.Core.Updates;

public sealed record RestartRequestModel(string Id, string Initiator, string Version);

public sealed record RestartAnswerModel(string Session, bool Accepted, int ProcessId);

public sealed record RestartDecisionModel(bool Go);

public enum RestartOutcome
{
    Waiting,
    Accepted,
    Refused,
    Silent
}

public sealed class RestartCoordination
{
    private const string DirectoryName = "restart";
    private const string RequestSuffix = ".request.json";
    private const string AnswerSuffix = ".answer.json";
    private const string DecisionSuffix = ".decision.json";

    public RestartCoordination(string dataDirectory)
    {
        Directory = Path.Combine(dataDirectory, DirectoryName);
    }

    public string Directory { get; }

    public RestartRequestModel Request(string initiator, string version)
    {
        var request = new RestartRequestModel(SessionFactory.NewId(), initiator, version);
        Write(request.Id + RequestSuffix, request);
        return request;
    }

    public IReadOnlyList<RestartRequestModel> OpenRequests() =>
        Files("*" + RequestSuffix)
            .Select(Read<RestartRequestModel>)
            .OfType<RestartRequestModel>()
            .Where(request => SessionStore.IsValidId(request.Id) && !File.Exists(PathOf(request.Id + DecisionSuffix)))
            .ToList();

    public void Answer(string id, string session, bool accepted, int processId) =>
        Write($"{id}.{session}{AnswerSuffix}", new RestartAnswerModel(session, accepted, processId));

    public IReadOnlyList<RestartAnswerModel> Answers(string id) =>
        Files($"{id}.*{AnswerSuffix}").Select(Read<RestartAnswerModel>).OfType<RestartAnswerModel>().ToList();

    public RestartOutcome Outcome(string id, IReadOnlyCollection<string> others, Func<string, bool> isOpen, bool expired)
    {
        var answers = Answers(id).Where(answer => others.Contains(answer.Session)).ToList();
        if (answers.Any(answer => !answer.Accepted))
        {
            return RestartOutcome.Refused;
        }

        var answered = answers.Select(answer => answer.Session).ToHashSet();
        if (others.All(session => answered.Contains(session) || !isOpen(session)))
        {
            return RestartOutcome.Accepted;
        }

        return expired ? RestartOutcome.Silent : RestartOutcome.Waiting;
    }

    public void Decide(string id, bool go) => Write(id + DecisionSuffix, new RestartDecisionModel(go));

    public RestartDecisionModel? Decision(string id) => Read<RestartDecisionModel>(PathOf(id + DecisionSuffix));

    public void Clear()
    {
        foreach (var file in Files("*"))
        {
            try
            {
                File.Delete(file);
            }
            catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
            {
            }
        }
    }

    private void Write<T>(string name, T value)
    {
        System.IO.Directory.CreateDirectory(Directory);
        AtomicFile.Write(PathOf(name), JsonSerializer.Serialize(value, SessionRepository.JsonOptions));
    }

    private IEnumerable<string> Files(string pattern) =>
        System.IO.Directory.Exists(Directory) ? System.IO.Directory.EnumerateFiles(Directory, pattern) : [];

    private string PathOf(string name) => Path.Combine(Directory, name);

    private static T? Read<T>(string path) where T : class
    {
        try
        {
            return File.Exists(path) ? JsonSerializer.Deserialize<T>(File.ReadAllText(path), SessionRepository.JsonOptions) : null;
        }
        catch (Exception exception) when (exception is JsonException or IOException or UnauthorizedAccessException)
        {
            return null;
        }
    }
}

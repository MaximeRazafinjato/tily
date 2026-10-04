using System.Text.Json;
using Tily.Core.Agents;
using Xunit;

namespace Tily.Core.Tests.Agents;

public sealed class PreviewRequestRepositoryTests : IDisposable
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), "tily-tests-" + Guid.NewGuid().ToString("N"));
    private readonly PreviewRequestRepository _repository;

    public PreviewRequestRepositoryTests()
    {
        _repository = new PreviewRequestRepository(_directory);
        Directory.CreateDirectory(_repository.Directory);
    }

    [Fact]
    public void TakeOwned_WhenHtmlRequested_ThenReturnsItAndDeletesTheFile()
    {
        var page = Page("relecture été.html");
        Request("pane1-a.json", "pane1", page);

        var requests = _repository.TakeOwned(_ => true);

        Assert.Equal(new PreviewRequestModel("pane1", page), Assert.Single(requests));
        Assert.Empty(Directory.EnumerateFiles(_repository.Directory));
    }

    [Fact]
    public void TakeOwned_WhenFileIsNotHtmlOrMissing_ThenIgnoresAndDeletesIt()
    {
        Request("pane1-texte.json", "pane1", Page("notes.txt"));
        Request("pane1-absent.json", "pane1", Path.Combine(_directory, "absent.html"));
        Request("pane1-relatif.json", "pane1", "plan.html");
        File.WriteAllText(Path.Combine(_repository.Directory, "pane1-illisible.json"), "{ oops");

        var requests = _repository.TakeOwned(_ => true);

        Assert.Empty(requests);
        Assert.Empty(Directory.EnumerateFiles(_repository.Directory));
    }

    [Fact]
    public void TakeOwned_WhenRequestStillBeingWritten_ThenLeavesTemporaryFile()
    {
        File.WriteAllText(Path.Combine(_repository.Directory, "pane1-abc.tmp"), "{");

        var requests = _repository.TakeOwned(_ => true);

        Assert.Empty(requests);
        Assert.Single(Directory.EnumerateFiles(_repository.Directory));
    }

    [Fact]
    public void TakeOwned_WhenPaneBelongsToAnotherInstance_ThenLeavesTheRequestUntouched()
    {
        Request("autre-pane-0f3a.json", "autre-pane", Page("plan.html"));

        var requests = _repository.TakeOwned(pane => pane == "mon-pane");

        Assert.Empty(requests);
        Assert.Single(Directory.EnumerateFiles(_repository.Directory));
    }

    [Fact]
    public void TakeOwned_WhenContentNamesAnotherPane_ThenDropsTheRequest()
    {
        Request("mon-pane-0f3a.json", "autre-pane", Page("plan.html"));

        var requests = _repository.TakeOwned(pane => pane == "mon-pane");

        Assert.Empty(requests);
        Assert.Empty(Directory.EnumerateFiles(_repository.Directory));
    }

    [Fact]
    public void Clear_WhenRequestsLeftFromPreviousRun_ThenDeletesThem()
    {
        Request("pane1-ancien.json", "pane1", Page("plan.html"));

        _repository.Clear();

        Assert.Empty(_repository.TakeOwned(_ => true));
    }

    private string Page(string name)
    {
        var path = Path.Combine(_directory, name);
        File.WriteAllText(path, "<h1>Plan</h1>");
        return path;
    }

    private void Request(string name, string paneId, string path) =>
        File.WriteAllText(Path.Combine(_repository.Directory, name), JsonSerializer.Serialize(new { pane = paneId, path }));

    public void Dispose()
    {
        if (Directory.Exists(_directory))
        {
            Directory.Delete(_directory, true);
        }
    }
}

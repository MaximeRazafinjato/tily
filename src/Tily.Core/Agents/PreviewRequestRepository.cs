using System.Text.Json;
using Tily.Core.Files;
using Tily.Core.Session;

namespace Tily.Core.Agents;

public sealed record PreviewRequestModel(string PaneId, string Path);

public sealed record PreviewRequestFileModel(string? Pane, string? Path);

public sealed class PreviewRequestRepository
{
    private const string RequestPattern = "*.json";

    public PreviewRequestRepository(string dataDirectory)
    {
        Directory = System.IO.Path.Combine(dataDirectory, "previews");
    }

    public string Directory { get; }

    public void Clear()
    {
        if (!System.IO.Directory.Exists(Directory))
        {
            return;
        }

        foreach (var file in System.IO.Directory.EnumerateFiles(Directory))
        {
            TryDelete(file);
        }
    }

    public IReadOnlyList<PreviewRequestModel> TakeOwned(Func<string, bool> ownsPane)
    {
        if (!System.IO.Directory.Exists(Directory))
        {
            return [];
        }

        var requests = new List<PreviewRequestModel>();
        foreach (var file in new DirectoryInfo(Directory).EnumerateFiles(RequestPattern).Where(file => ownsPane(PaneOf(file))).OrderBy(file => file.LastWriteTimeUtc).Select(file => file.FullName))
        {
            var request = Read(file);
            TryDelete(file);
            if (Valid(request) is { } valid && ownsPane(valid.PaneId))
            {
                requests.Add(valid);
            }
        }

        return requests;
    }

    private static string PaneOf(FileInfo file)
    {
        var name = System.IO.Path.GetFileNameWithoutExtension(file.Name);
        var separator = name.LastIndexOf('-');
        return separator > 0 ? name[..separator] : name;
    }

    private static PreviewRequestFileModel? Read(string file)
    {
        try
        {
            return JsonSerializer.Deserialize<PreviewRequestFileModel>(File.ReadAllText(file), SessionRepository.JsonOptions);
        }
        catch (Exception exception) when (exception is JsonException or IOException or UnauthorizedAccessException)
        {
            return null;
        }
    }

    private static PreviewRequestModel? Valid(PreviewRequestFileModel? request)
    {
        if (string.IsNullOrWhiteSpace(request?.Pane) || request.Path is not { } path || !System.IO.Path.IsPathFullyQualified(path) || !File.Exists(path) || PreviewTypes.KindOf(path) != PreviewKind.Html)
        {
            return null;
        }

        return new PreviewRequestModel(request.Pane.Trim(), System.IO.Path.GetFullPath(path));
    }

    private static void TryDelete(string file)
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

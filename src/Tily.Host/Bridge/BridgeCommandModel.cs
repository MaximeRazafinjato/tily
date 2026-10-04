using System.Text.Json;
using Tily.Core.Git;

namespace Tily.Host.Bridge;

public sealed class BridgeCommandModel
{
    public required string Type { get; init; }
    public string? Id { get; init; }
    public string? Error { get; init; }
    public string? Pane { get; init; }
    public string? Data { get; init; }
    public string? Shell { get; init; }
    public string? Cwd { get; init; }
    public string? Path { get; init; }
    public string? Target { get; init; }
    public string? Url { get; init; }
    public string? Href { get; init; }
    public string? Field { get; init; }
    public string? Title { get; init; }
    public string? Body { get; init; }
    public string? Location { get; init; }
    public string? Name { get; init; }
    public string? Kind { get; init; }
    public string? Parent { get; init; }
    public string? File { get; init; }
    public string? OldFile { get; init; }
    public string? Message { get; init; }
    public string? Level { get; init; }
    public string? Commit { get; init; }
    public string? Reference { get; init; }
    public string? NewName { get; init; }
    public string? Mode { get; init; }
    public string? Scope { get; init; }
    public string? Source { get; init; }
    public string? Repository { get; init; }
    public string? Project { get; init; }
    public string? Branch { get; init; }
    public string? Base { get; init; }
    public string? Folder { get; init; }
    public string? Command { get; init; }
    public string? Fingerprint { get; init; }
    public string? Content { get; init; }
    public string? Version { get; init; }
    public string[]? Panes { get; init; }
    public string[]? Keep { get; init; }
    public string[]? Paths { get; init; }
    public string[]? Files { get; init; }
    public string[]? Branches { get; init; }
    public string[]? RemoteBranches { get; init; }
    public string[]? Tags { get; init; }
    public string[]? Stashes { get; init; }
    public GitHunkSelectionModel[]? Selection { get; init; }
    public int Cols { get; init; }
    public int Rows { get; init; }
    public int Line { get; init; }
    public int Column { get; init; }
    public string? Alternative { get; init; }
    public int AlternativeLine { get; init; }
    public int AlternativeColumn { get; init; }
    public int Chars { get; init; }
    public int Count { get; init; }
    public int FontSize { get; init; }
    public int Index { get; init; }
    public int Request { get; init; }
    public bool Amend { get; init; }
    public bool Push { get; init; }
    public bool Force { get; init; }
    public bool Pop { get; init; }
    public bool Checkout { get; init; }
    public bool Untracked { get; init; }
    public bool Confirmed { get; init; }
    public bool RememberFolder { get; init; }
    public bool Install { get; init; }
    public bool Database { get; init; }
    public bool Remember { get; init; }
    public bool KeepBranch { get; init; }
    public bool DropDatabase { get; init; }
    public JsonElement? Session { get; init; }
    public JsonElement? Text { get; init; }
    public JsonElement? Settings { get; init; }
    public JsonElement? BaseSettings { get; init; }
    public JsonElement? Notifications { get; init; }
    public JsonElement? Result { get; init; }
}

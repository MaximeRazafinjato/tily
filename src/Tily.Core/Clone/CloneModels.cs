namespace Tily.Core.Clone;

public sealed record CloneRequestModel(string? Address, string? Folder, string? Name);

public sealed record ClonePlanModel(string Name, string Folder, string? Path, string? PathPreview, string? Error);

public sealed record CloneResultModel(string Path, string Name);

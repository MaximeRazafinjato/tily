using System.Text.Json.Serialization;

namespace Tily.Core.Git;

[JsonConverter(typeof(JsonStringEnumConverter<GitFailureCode>))]
public enum GitFailureCode
{
    [JsonStringEnumMemberName("none")] None,
    [JsonStringEnumMemberName("notMerged")] NotMerged,
    [JsonStringEnumMemberName("conflictMarkers")] ConflictMarkers,
    [JsonStringEnumMemberName("fileChanged")] FileChanged
}

public class GitCommandException : Exception
{
    public GitCommandException(string message, string output, GitFailureCode code = GitFailureCode.None) : base(message)
    {
        Output = output;
        Code = code;
    }

    public string Output { get; }

    public GitFailureCode Code { get; }
}

public sealed class GitPushRejectedException : GitCommandException
{
    public GitPushRejectedException(string branch, string message, string output) : base(message, output) => Branch = branch;

    public string Branch { get; }
}

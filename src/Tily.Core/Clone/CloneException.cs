namespace Tily.Core.Clone;

public sealed class CloneException : Exception
{
    public CloneException(string message, string output = "") : base(message) => Output = output;

    public string Output { get; }
}

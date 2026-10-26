using Tily.Core.Forge;

namespace Tily.Core.Tests.Forge;

internal sealed class FakeForgeRunner(Func<IReadOnlyList<string>, ForgeOutputModel> answer) : IForgeCommandRunner
{
    public List<(ForgeKind Kind, IReadOnlyList<string> Arguments)> Calls { get; } = [];

    public List<string?> Inputs { get; } = [];

    public static FakeForgeRunner Answering(string output) => new(_ => new ForgeOutputModel(0, output, string.Empty));

    public ForgeOutputModel Run(ForgeKind kind, string directory, IReadOnlyList<string> arguments, string? input = null)
    {
        Calls.Add((kind, arguments));
        Inputs.Add(input);
        return answer(arguments);
    }
}

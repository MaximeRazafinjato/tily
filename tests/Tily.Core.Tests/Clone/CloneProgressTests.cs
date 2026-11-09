using Tily.Core.Clone;
using Xunit;

namespace Tily.Core.Tests.Clone;

public sealed class CloneProgressTests
{
    [Theory]
    [InlineData("Receiving objects:  45% (450/1000), 1.20 MiB | 512.00 KiB/s", "réception des objets, 45 %")]
    [InlineData("remote: Counting objects: 100% (12/12), done.", "décompte des objets, 100 %")]
    [InlineData("remote: Compressing objects:   3% (1/30)", "compression des objets, 3 %")]
    [InlineData("Resolving deltas:  80% (8/10)", "résolution des deltas, 80 %")]
    [InlineData("Updating files:  12% (120/1000)", "extraction des fichiers, 12 %")]
    public void Describe_WhenGitProgressLine_ThenTranslatesStepAndPercent(string line, string expected)
    {
        var step = CloneProgress.Describe(line);

        Assert.Equal(expected, step);
    }

    [Theory]
    [InlineData("Cloning into 'tily'...")]
    [InlineData("remote: Enumerating objects: 1234, done.")]
    [InlineData("fatal: repository not found")]
    public void Describe_WhenOtherLine_ThenIgnoresIt(string line)
    {
        var step = CloneProgress.Describe(line);

        Assert.Null(step);
    }

    [Fact]
    public void Report_WhenSameStepRepeats_ThenReportsOnlyChanges()
    {
        var messages = new List<string>();
        var progress = new CloneProgress("tily", messages.Add);

        progress.Report("Receiving objects:  1% (1/100)");
        progress.Report("Receiving objects:  1% (1/100), 10 KiB | 5 KiB/s");
        progress.Report("Cloning into 'tily'...");
        progress.Report("Receiving objects:  2% (2/100)");

        Assert.Equal(["Clonage de « tily » : réception des objets, 1 %.", "Clonage de « tily » : réception des objets, 2 %."], messages);
    }
}

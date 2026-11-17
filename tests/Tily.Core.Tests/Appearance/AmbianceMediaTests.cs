using Tily.Core.Appearance;
using Xunit;

namespace Tily.Core.Tests.Appearance;

public sealed class AmbianceMediaTests : IDisposable
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), $"tily-ambiance-é-{Guid.NewGuid():N}");

    public AmbianceMediaTests() => Directory.CreateDirectory(_directory);

    public void Dispose() => Directory.Delete(_directory, recursive: true);

    [Fact]
    public void Import_WhenImage_ThenCopiedIntoMediaFolder()
    {
        var source = Path.Combine(_directory, "fond d'écran.png");
        File.WriteAllBytes(source, [1, 2, 3]);
        var media = new AmbianceMedia(Path.Combine(_directory, "data"));

        var name = media.Import(source);

        Assert.Equal([1, 2, 3], File.ReadAllBytes(Path.Combine(media.Folder, name)));
    }

    [Fact]
    public void Import_WhenNotAMedia_ThenFailsInFrench()
    {
        var source = Path.Combine(_directory, "script.ps1");
        File.WriteAllText(source, "Remove-Item");
        var media = new AmbianceMedia(Path.Combine(_directory, "data"));

        var error = Assert.Throws<InvalidOperationException>(() => media.Import(source));

        Assert.StartsWith("Image ou vidéo attendue", error.Message);
    }

    [Fact]
    public void Purge_WhenSeveralFiles_ThenKeepsOnlyCurrentOne()
    {
        var media = new AmbianceMedia(_directory);
        Directory.CreateDirectory(media.Folder);
        File.WriteAllText(Path.Combine(media.Folder, "ancien.jpg"), "a");
        File.WriteAllText(Path.Combine(media.Folder, "actuel.mp4"), "b");

        media.Purge("actuel.mp4");

        Assert.Equal(["actuel.mp4"], Directory.GetFiles(media.Folder).Select(Path.GetFileName));
    }

    [Theory]
    [InlineData("fond.webm", true)]
    [InlineData("..\\fond.png", false)]
    [InlineData("C:\\fond.png", false)]
    [InlineData("fond.exe", false)]
    public void IsMediaName_WhenName_ThenOnlyBareMediaFileNames(string name, bool expected)
    {
        var accepted = AmbianceMedia.IsMediaName(name);

        Assert.Equal(expected, accepted);
    }
}

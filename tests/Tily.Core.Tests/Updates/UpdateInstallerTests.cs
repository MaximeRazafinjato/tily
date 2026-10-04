using Tily.Core.Updates;
using Xunit;

namespace Tily.Core.Tests.Updates;

public sealed class UpdateInstallerTests : IDisposable
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), "tily-tests-" + Guid.NewGuid().ToString("N"));

    [Theory]
    [InlineData(true, "/SILENT /NORESTART /ALLUSERS /RELAUNCH=1 /WAITPID=4242")]
    [InlineData(false, "/SILENT /NORESTART /CURRENTUSER /RELAUNCH=1 /WAITPID=4242")]
    public void Arguments_WhenInstallModeKnown_ThenKeepsItAndAsksForRelaunch(bool allUsers, string expected)
    {
        var arguments = UpdateInstaller.Arguments(allUsers, [4242]);

        Assert.Equal(expected, arguments);
    }

    [Fact]
    public void Arguments_WhenSeveralWindowsClose_ThenWaitsForEveryProcessOnce()
    {
        var arguments = UpdateInstaller.Arguments(false, [4242, 5150, 4242]);

        Assert.EndsWith("/WAITPID=4242,5150", arguments);
    }

    [Fact]
    public void IsAllUsers_WhenUnderProgramFiles_ThenTrue()
    {
        var directory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Tily");

        var allUsers = UpdateInstaller.IsAllUsers(directory);

        Assert.True(allUsers);
    }

    [Fact]
    public void IsAllUsers_WhenUnderLocalAppData_ThenFalse()
    {
        var directory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Tily");

        var allUsers = UpdateInstaller.IsAllUsers(directory);

        Assert.False(allUsers);
    }

    [Fact]
    public void IsInstalled_WhenUninstallerPresent_ThenTrue()
    {
        Directory.CreateDirectory(_directory);
        File.WriteAllText(Path.Combine(_directory, UpdateInstaller.UninstallerName), string.Empty);

        var installed = UpdateInstaller.IsInstalled(_directory);

        Assert.True(installed);
    }

    [Fact]
    public void IsInstalled_WhenDevelopmentBuild_ThenFalse()
    {
        Directory.CreateDirectory(_directory);

        var installed = UpdateInstaller.IsInstalled(_directory);

        Assert.False(installed);
    }

    public void Dispose()
    {
        if (Directory.Exists(_directory))
        {
            Directory.Delete(_directory, true);
        }
    }
}

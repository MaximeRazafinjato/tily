using Tily.Core.Clone;
using Xunit;

namespace Tily.Core.Tests.Clone;

public sealed class ClonePlannerTests : IDisposable
{
    private const string Address = "https://github.com/MaximeRazafinjato/tily.git";

    private readonly string _root = Path.Combine(Path.GetTempPath(), "tily-clonage-" + Guid.NewGuid().ToString("N"), "Projets à cloner");

    public ClonePlannerTests() => Directory.CreateDirectory(_root);

    [Fact]
    public void Plan_WhenOnlyAddressGiven_ThenClonesIntoDefaultFolderUnderRepositoryName()
    {
        var plan = ClonePlanner.Plan(new CloneRequestModel(Address, null, null), _root);

        Assert.Equal(new ClonePlanModel("tily", _root, Path.Combine(_root, "tily"), Path.Combine(_root, "tily"), null), plan);
    }

    [Fact]
    public void Plan_WhenFolderAndNameGiven_ThenUsesThem()
    {
        var folder = Path.Combine(_root, "autre");

        var plan = ClonePlanner.Plan(new CloneRequestModel(Address, $" {folder} ", " Tily maison "), _root);

        Assert.Equal(Path.Combine(folder, "Tily maison"), plan.Path);
    }

    [Fact]
    public void Plan_WhenAddressEmpty_ThenNeitherPathNorError()
    {
        var plan = ClonePlanner.Plan(new CloneRequestModel(" ", null, null), _root);

        Assert.Equal(new ClonePlanModel(string.Empty, _root, null, null, null), plan);
    }

    [Fact]
    public void Plan_WhenTargetExists_ThenRefusesInFrench()
    {
        Directory.CreateDirectory(Path.Combine(_root, "tily"));

        var plan = ClonePlanner.Plan(new CloneRequestModel(Address, null, null), _root);

        Assert.Equal($"Le dossier existe déjà : {Path.Combine(_root, "tily")}", plan.Error);
    }

    [Fact]
    public void Plan_WhenTargetRefused_ThenStillPreviewsPath()
    {
        Directory.CreateDirectory(Path.Combine(_root, "tily"));

        var plan = ClonePlanner.Plan(new CloneRequestModel(Address, null, null), _root);

        Assert.Equal((null, Path.Combine(_root, "tily")), (plan.Path, plan.PathPreview));
    }

    [Fact]
    public void Plan_WhenFolderRelative_ThenRefusesInFrench()
    {
        var plan = ClonePlanner.Plan(new CloneRequestModel(Address, "relatif", null), _root);

        Assert.Equal("Le dossier de destination doit être un chemin absolu : relatif", plan.Error);
    }

    [Fact]
    public void Plan_WhenNameInvalid_ThenRefusesInFrench()
    {
        var plan = ClonePlanner.Plan(new CloneRequestModel(Address, null, "a:b"), _root);

        Assert.StartsWith("Nom invalide : « a:b »", plan.Error);
    }

    [Fact]
    public void Plan_WhenAddressHasNoName_ThenAsksForName()
    {
        var plan = ClonePlanner.Plan(new CloneRequestModel("https://github.com", null, null), _root);

        Assert.Equal("Indiquez le nom du dossier du dépôt.", plan.Error);
    }

    [Fact]
    public void Plan_WhenAddressInvalid_ThenReportsAddressError()
    {
        var plan = ClonePlanner.Plan(new CloneRequestModel("ext::sh", null, "depot"), _root);

        Assert.Equal("Adresse de dépôt invalide : ext::sh", plan.Error);
    }

    public void Dispose()
    {
        var parent = Path.GetDirectoryName(_root)!;
        if (Directory.Exists(parent))
        {
            Directory.Delete(parent, true);
        }
    }
}

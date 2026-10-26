using Tily.Core.Forge;
using Xunit;

namespace Tily.Core.Tests.Forge;

public sealed class MergeRequestInputsTests
{
    private static MergeRequestInputModel Input(string source = "feat/creation", string target = "develop", string title = "Créer des MR/PR") =>
        new(source, target, title, "Description\r\n\r\n", [" alice ", "alice", "", "bob"], "  ", ["git", "git", "enhancement"], true);

    [Fact]
    public void Normalize_WhenValuesPadded_ThenTrimsAndRemovesDuplicates()
    {
        var input = MergeRequestInputs.Normalize(Input(" feat/creation ", "develop ", "  Créer des MR/PR "));

        Assert.Equal(
            ("feat/creation", "develop", "Créer des MR/PR", "Description", "alice,bob", null, "git,enhancement", true),
            (input.SourceBranch, input.TargetBranch, input.Title, input.Description, string.Join(',', input.Reviewers), input.Assignee, string.Join(',', input.Labels), input.Draft));
    }

    [Fact]
    public void Normalize_WhenTitleBlank_ThenRefuses()
    {
        var exception = Assert.Throws<ForgeException>(() => MergeRequestInputs.Normalize(Input(title: "   ")));

        Assert.Equal("Le titre est obligatoire.", exception.Message);
    }

    [Fact]
    public void Normalize_WhenTitleTooLong_ThenRefuses()
    {
        var exception = Assert.Throws<ForgeException>(() => MergeRequestInputs.Normalize(Input(title: new string('a', MergeRequestInputs.TitleMaxLength + 1))));

        Assert.Equal("Titre trop long : 255 caractères au plus.", exception.Message);
    }

    [Fact]
    public void Normalize_WhenSourceEqualsTarget_ThenRefuses()
    {
        var exception = Assert.Throws<ForgeException>(() => MergeRequestInputs.Normalize(Input("develop", "develop")));

        Assert.Equal("La branche source et la branche cible sont identiques.", exception.Message);
    }

    [Fact]
    public void Normalize_WhenTargetMissing_ThenAsksToChooseIt()
    {
        var exception = Assert.Throws<ForgeException>(() => MergeRequestInputs.Normalize(Input(target: "")));

        Assert.Equal("Choisissez la branche cible.", exception.Message);
    }

    [Fact]
    public void Normalize_WhenBranchLooksLikeOption_ThenRefuses()
    {
        var exception = Assert.Throws<ForgeException>(() => MergeRequestInputs.Normalize(Input(source: "--force")));

        Assert.Equal("Nom de branche source invalide : « --force ».", exception.Message);
    }
}

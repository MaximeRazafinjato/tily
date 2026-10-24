using Tily.Core.Forge;
using Xunit;

namespace Tily.Core.Tests.Forge;

public sealed class GlabHostsTests
{
    [Fact]
    public void Parse_WhenConfigDeclaresHosts_ThenListsOnlyHostKeys()
    {
        string[] lines =
        [
            "git_protocol: ssh",
            "host: gitlab.com",
            "hosts:",
            "    gitlab.com:",
            "        api_protocol: https",
            "        api_host: gitlab.com",
            "        custom_headers: []",
            "    # commentaire",
            "    \"Git.Ftel.fr\":",
            "        use_keyring: \"true\"",
            "        user: ram",
            "aliases:",
            "    autre.example:"
        ];

        var hosts = GlabHosts.Parse(lines);

        Assert.Equal(["git.ftel.fr", "gitlab.com"], hosts.Order());
    }

    [Fact]
    public void Parse_WhenNoHostsSection_ThenEmpty()
    {
        var hosts = GlabHosts.Parse(["git_protocol: ssh", "host: gitlab.com"]);

        Assert.Empty(hosts);
    }
}

using Tily.Core.Files;

namespace Tily.Core.Clone;

public static class ClonePlanner
{
    public static ClonePlanModel Plan(CloneRequestModel request, string defaultFolder)
    {
        var folder = string.IsNullOrWhiteSpace(request.Folder) ? defaultFolder.Trim() : request.Folder.Trim();
        var address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim();
        var name = string.IsNullOrWhiteSpace(request.Name) ? (address is null ? string.Empty : CloneAddress.NameOf(address)) : request.Name.Trim();
        var preview = name.Length > 0 && Path.IsPathFullyQualified(folder) ? Path.Combine(folder, name) : null;
        if (address is null)
        {
            return new ClonePlanModel(name, folder, null, preview, null);
        }

        try
        {
            var path = Target(address, folder, name);
            return new ClonePlanModel(name, folder, path, path, null);
        }
        catch (CloneException exception)
        {
            return new ClonePlanModel(name, folder, null, preview, exception.Message);
        }
    }

    private static string Target(string address, string folder, string name)
    {
        CloneAddress.Require(address);
        if (folder.Length == 0)
        {
            throw new CloneException("Indiquez le dossier où cloner le dépôt.");
        }

        if (!Path.IsPathFullyQualified(folder))
        {
            throw new CloneException($"Le dossier de destination doit être un chemin absolu : {folder}");
        }

        if (name.Length == 0)
        {
            throw new CloneException("Indiquez le nom du dossier du dépôt.");
        }

        try
        {
            FileExplorer.RequireValidName(name);
        }
        catch (InvalidOperationException exception)
        {
            throw new CloneException(exception.Message);
        }

        var path = Path.GetFullPath(Path.Combine(folder, name));
        return Directory.Exists(path) || File.Exists(path) ? throw new CloneException($"Le dossier existe déjà : {path}") : path;
    }
}

namespace Tily.Core.Appearance;

public sealed class AmbianceMedia
{
    public const string FolderName = "ambiance";

    private static readonly HashSet<string> Extensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp", ".mp4", ".webm"
    };

    public AmbianceMedia(string dataDirectory)
    {
        Folder = Path.Combine(dataDirectory, FolderName);
    }

    public string Folder { get; }

    public static bool IsMediaName(string? name) =>
        !string.IsNullOrWhiteSpace(name)
        && name == Path.GetFileName(name)
        && name.IndexOfAny(Path.GetInvalidFileNameChars()) < 0
        && Extensions.Contains(Path.GetExtension(name));

    public string Import(string source)
    {
        var name = Path.GetFileName(source);
        if (!Path.IsPathFullyQualified(source) || !IsMediaName(name))
        {
            throw new InvalidOperationException("Image ou vidéo attendue : png, jpg, gif, webp, avif, bmp, mp4 ou webm.");
        }

        if (!File.Exists(source))
        {
            throw new InvalidOperationException($"Fichier introuvable : {source}");
        }

        Directory.CreateDirectory(Folder);
        File.Copy(source, Path.Combine(Folder, name), overwrite: true);
        return name;
    }

    public void Purge(string? kept)
    {
        if (!Directory.Exists(Folder))
        {
            return;
        }

        foreach (var file in Directory.EnumerateFiles(Folder).Where(file => !string.Equals(Path.GetFileName(file), kept, StringComparison.OrdinalIgnoreCase)))
        {
            try
            {
                File.Delete(file);
            }
            catch (IOException)
            {
            }
            catch (UnauthorizedAccessException)
            {
            }
        }
    }
}

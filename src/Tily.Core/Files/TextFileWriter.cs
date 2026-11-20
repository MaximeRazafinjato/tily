using System.Globalization;
using System.Text;

namespace Tily.Core.Files;

public static class TextFileWriter
{
    private const string Crlf = "\r\n";
    private const string Lf = "\n";
    private const string Cr = "\r";
    private const char LastLatin1Char = 'ÿ';
    private static readonly UTF8Encoding Utf8WithoutBom = new(false);
    private static readonly UTF8Encoding Utf8WithBom = new(true);
    private static readonly UTF8Encoding StrictUtf8 = new(false, true);

    public static string? VersionOf(string path) =>
        File.Exists(path) ? File.GetLastWriteTimeUtc(path).Ticks.ToString(CultureInfo.InvariantCulture) : null;

    public static string? Save(string path, string content, string? version, bool force)
    {
        FileExplorer.RequireFullPath(path);
        var kind = PreviewTypes.KindOf(path);
        if (kind is null or PreviewKind.Image)
        {
            return $"Ce type de fichier ne se modifie pas dans Tily : {Path.GetFileName(path)}.";
        }

        try
        {
            var current = VersionOf(path);
            if (!force && current != version)
            {
                return current is null
                    ? $"Le fichier a été supprimé depuis son ouverture : {path}"
                    : "Le fichier a été modifié sur le disque depuis son ouverture.";
            }

            var existing = current is null ? [] : File.ReadAllBytes(path);
            if (existing.Length > FilePreview.MaxBytes)
            {
                return "Fichier trop volumineux pour être modifié dans Tily (plus de 2 Mo).";
            }

            var (encoding, text) = Detect(existing);
            if (encoding is null)
            {
                return "Fichier binaire : modification impossible.";
            }

            var output = WithLineEndings(content, text.Contains(Crlf, StringComparison.Ordinal) ? Crlf : Lf);
            var invalid = encoding == Encoding.Latin1 ? FirstOutsideLatin1(output) : null;
            if (invalid is not null)
            {
                return $"Ce fichier est encodé en Latin-1 : le caractère « {invalid} » ne peut pas y être enregistré.";
            }

            File.WriteAllBytes(path, [.. encoding.GetPreamble(), .. encoding.GetBytes(output)]);
            return null;
        }
        catch (Exception exception) when (exception is UnauthorizedAccessException or IOException)
        {
            return $"Enregistrement impossible : {exception.Message}";
        }
    }

    public static (Encoding? Encoding, string Text) Detect(byte[] bytes)
    {
        if (bytes.AsSpan().StartsWith(Utf8WithBom.Preamble))
        {
            return (Utf8WithBom, Utf8WithBom.GetString(bytes, 3, bytes.Length - 3));
        }

        if (bytes.AsSpan().StartsWith(Encoding.Unicode.Preamble))
        {
            return (Encoding.Unicode, Encoding.Unicode.GetString(bytes, 2, bytes.Length - 2));
        }

        if (bytes.AsSpan().StartsWith(Encoding.BigEndianUnicode.Preamble))
        {
            return (Encoding.BigEndianUnicode, Encoding.BigEndianUnicode.GetString(bytes, 2, bytes.Length - 2));
        }

        if (bytes.AsSpan().Contains((byte)0))
        {
            return (null, string.Empty);
        }

        try
        {
            return (Utf8WithoutBom, StrictUtf8.GetString(bytes));
        }
        catch (DecoderFallbackException)
        {
            return (Encoding.Latin1, Encoding.Latin1.GetString(bytes));
        }
    }

    public static string WithLineEndings(string content, string newLine) =>
        content.Replace(Crlf, Lf, StringComparison.Ordinal).Replace(Cr, Lf, StringComparison.Ordinal).Replace(Lf, newLine, StringComparison.Ordinal);

    public static string? FirstOutsideLatin1(string text)
    {
        var index = text.AsSpan().IndexOfAnyExceptInRange(char.MinValue, LastLatin1Char);
        return index < 0 ? null : char.IsHighSurrogate(text[index]) && index + 1 < text.Length ? text.Substring(index, 2) : text[index].ToString();
    }
}

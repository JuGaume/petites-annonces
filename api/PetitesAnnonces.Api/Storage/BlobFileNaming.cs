namespace PetitesAnnonces.Api.Storage;

/// <summary>
/// Détermine l'extension du fichier stocké à partir du content-type effectivement écrit,
/// plutôt que du nom de fichier d'origine envoyé par le client. Les deux implémentations
/// de <see cref="IBlobStorageService"/> réencodent toujours les images (voir
/// <c>ThumbnailGenerator</c>) avant de les stocker : un JPEG ou HEIC envoyé par le client
/// est réécrit en WebP, donc l'extension doit suivre le contenu réel, pas l'upload initial
/// — sinon le fichier stocké porte une extension trompeuse (ex. photo.jpg contenant en
/// réalité du WebP).
/// </summary>
public static class BlobFileNaming
{
    public static string ExtensionFor(string contentType, string originalFileName) => contentType switch
    {
        "image/webp" => ".webp",
        "image/jpeg" => ".jpg",
        "image/png" => ".png",
        "image/gif" => ".gif",
        _ => Path.GetExtension(originalFileName),
    };
}

namespace PetitesAnnonces.Api.Storage;

public class BlobStorageOptions
{
    public const string SectionName = "BlobStorage";

    /// <summary>
    /// Chaîne de connexion Azure Storage. Laissée vide en dev : dans ce cas,
    /// <see cref="LocalDiskBlobStorageService"/> est utilisé à la place (voir Program.cs).
    /// </summary>
    public string? AzureConnectionString { get; set; }

    public string ContainerName { get; set; } = "listing-images";

    /// <summary>Dossier racine (relatif au dossier de contenu de l'API) pour le stockage disque local.</summary>
    public string LocalRootPath { get; set; } = "App_Data/uploads";

    /// <summary>Segment d'URL sous lequel le dossier local est servi (voir <c>UseStaticFiles</c> dans Program.cs).</summary>
    public string LocalRequestPath { get; set; } = "/uploads";
}

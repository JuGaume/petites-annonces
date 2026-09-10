namespace PetitesAnnonces.Api.Storage;

/// <summary>Résultat d'un enregistrement : la clé interne (pour une suppression future) et l'URL publique.</summary>
public record StoredBlob(string StoragePath, string Url);

/// <summary>
/// Abstraction de stockage des fichiers (photos d'annonces). Deux implémentations : disque
/// local pour le dev (voir <see cref="LocalDiskBlobStorageService"/>, pas de conteneur
/// requis — même logique que pour la base de données en Phase 0), Azure Blob Storage en
/// prod (<see cref="AzureBlobStorageService"/>).
/// </summary>
public interface IBlobStorageService
{
    Task<StoredBlob> SaveAsync(Stream content, string fileName, string contentType, CancellationToken cancellationToken = default);

    Task DeleteAsync(string storagePath, CancellationToken cancellationToken = default);
}

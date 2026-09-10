using Azure.Storage.Blobs;
using Microsoft.Extensions.Options;

namespace PetitesAnnonces.Api.Storage;

/// <summary>
/// Stockage réel en production via Azure Blob Storage. Utilisé quand une chaîne de
/// connexion est configurée ; sinon <see cref="LocalDiskBlobStorageService"/> prend le relais.
/// </summary>
public class AzureBlobStorageService : IBlobStorageService
{
    private readonly BlobContainerClient _container;

    public AzureBlobStorageService(IOptions<BlobStorageOptions> options)
    {
        var settings = options.Value;
        _container = new BlobContainerClient(settings.AzureConnectionString, settings.ContainerName);
        _container.CreateIfNotExists(Azure.Storage.Blobs.Models.PublicAccessType.Blob);
    }

    public async Task<StoredBlob> SaveAsync(Stream content, string fileName, string contentType, CancellationToken cancellationToken = default)
    {
        var storagePath = $"{Guid.NewGuid():N}{Path.GetExtension(fileName)}";
        var blob = _container.GetBlobClient(storagePath);

        await blob.UploadAsync(
            content,
            new Azure.Storage.Blobs.Models.BlobHttpHeaders { ContentType = contentType },
            cancellationToken: cancellationToken);

        return new StoredBlob(storagePath, blob.Uri.ToString());
    }

    public async Task DeleteAsync(string storagePath, CancellationToken cancellationToken = default)
    {
        await _container.GetBlobClient(storagePath).DeleteIfExistsAsync(cancellationToken: cancellationToken);
    }
}

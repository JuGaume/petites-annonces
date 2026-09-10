using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;

namespace PetitesAnnonces.Api.Storage;

/// <summary>
/// Implémentation de secours pour le développement local et les tests : écrit les
/// fichiers sur le disque de l'API, servis ensuite en statique (voir <c>UseStaticFiles</c>
/// dans Program.cs). Utilisée tant qu'aucune chaîne de connexion Azure Storage n'est
/// configurée — évite de dépendre d'un conteneur (Azurite) pour développer, dans le même
/// esprit que SQL Server LocalDB pour la base de données en Phase 0.
/// </summary>
public class LocalDiskBlobStorageService(
    IWebHostEnvironment environment,
    IHttpContextAccessor httpContextAccessor,
    IOptions<BlobStorageOptions> options) : IBlobStorageService
{
    private readonly BlobStorageOptions _options = options.Value;

    public async Task<StoredBlob> SaveAsync(Stream content, string fileName, string contentType, CancellationToken cancellationToken = default)
    {
        var rootPath = Path.Combine(environment.ContentRootPath, _options.LocalRootPath);
        Directory.CreateDirectory(rootPath);

        var storagePath = $"{Guid.NewGuid():N}{Path.GetExtension(fileName)}";
        var fullPath = Path.Combine(rootPath, storagePath);

        await using (var fileStream = File.Create(fullPath))
        {
            await content.CopyToAsync(fileStream, cancellationToken);
        }

        return new StoredBlob(storagePath, BuildUrl(storagePath));
    }

    public Task DeleteAsync(string storagePath, CancellationToken cancellationToken = default)
    {
        var fullPath = Path.Combine(environment.ContentRootPath, _options.LocalRootPath, storagePath);
        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
        }

        return Task.CompletedTask;
    }

    private string BuildUrl(string storagePath)
    {
        var request = httpContextAccessor.HttpContext?.Request;
        var basePath = _options.LocalRequestPath.TrimEnd('/');

        // En dehors d'une requête HTTP (tests, tâches de fond), on retombe sur un chemin
        // relatif : seule l'origine absolue du front/API pour la construire manque.
        if (request is null)
        {
            return $"{basePath}/{storagePath}";
        }

        return $"{request.Scheme}://{request.Host}{basePath}/{storagePath}";
    }
}

using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.Processing;

namespace PetitesAnnonces.Api.Images;

/// <summary>Génère la miniature et la version optimisée d'une photo d'annonce à l'upload (voir spec §9, performance).</summary>
public static class ThumbnailGenerator
{
    private const int MaxDimension = 480;

    // Le fichier tel qu'envoyé par le client (jusqu'à 5 Mo, voir CreateListingRequestValidator)
    // passait jusqu'ici tel quel vers le stockage : une photo de smartphone moderne peut
    // dépasser 4000px de large sans que l'affichage (page annonce) n'en ait jamais besoin.
    // On le recompresse donc lui aussi, avec une taille max plus généreuse que la miniature.
    private const int MaxOriginalDimension = 1600;

    // WebP plutôt que JPEG : ~25-35% de poids en moins à qualité équivalente, supporté par
    // tous les navigateurs ciblés (spec §9, performance). SixLabors.ImageSharp l'encode
    // nativement, aucun package supplémentaire n'est nécessaire.
    public const string ThumbnailContentType = "image/webp";
    public const string OptimizedContentType = "image/webp";

    public static async Task<MemoryStream> CreateAsync(Stream source, CancellationToken cancellationToken = default)
    {
        source.Position = 0;
        using var image = await Image.LoadAsync(source, cancellationToken);

        image.Mutate(x => x.Resize(new ResizeOptions
        {
            Mode = ResizeMode.Max,
            Size = new Size(MaxDimension, MaxDimension),
        }));

        var output = new MemoryStream();
        await image.SaveAsync(output, new WebpEncoder { Quality = 80 }, cancellationToken);
        output.Position = 0;
        return output;
    }

    /// <summary>
    /// Recompresse l'image « originale » affichée sur la page de détail : redimensionnée si
    /// besoin (ResizeMode.Max ne fait jamais d'agrandissement) et réencodée en WebP qualité 85,
    /// pour réduire le poids du payload sans dégradation visible (spec §9, performance).
    /// </summary>
    public static async Task<MemoryStream> CreateOptimizedOriginalAsync(Stream source, CancellationToken cancellationToken = default)
    {
        source.Position = 0;
        using var image = await Image.LoadAsync(source, cancellationToken);

        image.Mutate(x => x.Resize(new ResizeOptions
        {
            Mode = ResizeMode.Max,
            Size = new Size(MaxOriginalDimension, MaxOriginalDimension),
        }));

        var output = new MemoryStream();
        await image.SaveAsync(output, new WebpEncoder { Quality = 85 }, cancellationToken);
        output.Position = 0;
        return output;
    }
}

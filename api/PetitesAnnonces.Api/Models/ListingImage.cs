namespace PetitesAnnonces.Api.Models;

/// <summary>
/// Photo d'une annonce. <see cref="StoragePath"/>/<see cref="ThumbnailStoragePath"/>
/// sont les clés internes au fournisseur de stockage (voir <c>Storage/IBlobStorageService</c>),
/// nécessaires pour pouvoir supprimer les fichiers quand l'annonce est supprimée ;
/// <see cref="Url"/>/<see cref="ThumbnailUrl"/> sont les URLs publiques servies au front.
/// </summary>
public class ListingImage
{
    public int Id { get; set; }

    public int ListingId { get; set; }

    public Listing? Listing { get; set; }

    public required string StoragePath { get; set; }

    public required string Url { get; set; }

    public required string ThumbnailStoragePath { get; set; }

    public required string ThumbnailUrl { get; set; }

    /// <summary>Ordre d'affichage dans la galerie de l'annonce.</summary>
    public int Position { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

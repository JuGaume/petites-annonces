namespace PetitesAnnonces.Api.Contracts;

/// <summary>Annonce favorite, avec assez de contexte (groupe) pour l'afficher hors de son flux d'origine.</summary>
public record FavoriteListingResponse(
    int ListingId,
    int GroupId,
    string GroupName,
    string Title,
    decimal? Price,
    string Mode,
    string Status,
    string? ThumbnailUrl,
    DateTimeOffset FavoritedAt);

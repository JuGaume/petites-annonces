using Microsoft.AspNetCore.Http;
using PetitesAnnonces.Api.Models;

namespace PetitesAnnonces.Api.Contracts;

/// <summary>
/// Modèle de liaison pour la création d'une annonce (multipart/form-data, pour accueillir
/// les photos). Classe (et non record) à propriétés mutables : liaison de formulaire plus
/// prévisible qu'un constructeur positionnel quand une liste de fichiers est en jeu.
/// </summary>
public class CreateListingRequest
{
    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    public decimal? Price { get; set; }

    public ListingMode Mode { get; set; }

    public int CategoryId { get; set; }

    public ContactMode ContactMode { get; set; }

    public string? ContactDetails { get; set; }

    public List<IFormFile> Images { get; set; } = [];
}

public record UpdateListingStatusRequest(ListingStatus Status);

public record ListingImageResponse(int Id, string Url, string ThumbnailUrl);

public record ListingSummaryResponse(
    int Id,
    string Title,
    decimal? Price,
    string Mode,
    string Status,
    string CategoryName,
    string? ThumbnailUrl,
    DateTimeOffset CreatedAt,
    bool IsFavorite);

public record ListingDetailResponse(
    int Id,
    string Title,
    string? Description,
    decimal? Price,
    string Mode,
    string Status,
    int CategoryId,
    string CategoryName,
    string AuthorUserId,
    string AuthorDisplayName,
    string ContactMode,
    string? ContactDetails,
    DateTimeOffset CreatedAt,
    IReadOnlyList<ListingImageResponse> Images,
    bool IsFavorite);

public record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount);

public record CategoryResponse(int Id, string Name);

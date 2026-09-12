namespace PetitesAnnonces.Api.Contracts;

public record CreateSavedSearchRequest(string Label, int? CategoryId, string? Search, decimal? MinPrice, decimal? MaxPrice);

public record SavedSearchResponse(
    int Id,
    string Label,
    int? CategoryId,
    string? Search,
    decimal? MinPrice,
    decimal? MaxPrice,
    DateTimeOffset CreatedAt);

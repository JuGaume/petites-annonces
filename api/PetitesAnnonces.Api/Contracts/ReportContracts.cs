namespace PetitesAnnonces.Api.Contracts;

public record CreateReportRequest(string Reason, string? Details);

public record AdminReportResponse(
    int Id,
    int ListingId,
    string ListingTitle,
    int GroupId,
    string GroupName,
    string ReporterUserId,
    string ReporterDisplayName,
    string Reason,
    string? Details,
    string Status,
    DateTimeOffset CreatedAt);

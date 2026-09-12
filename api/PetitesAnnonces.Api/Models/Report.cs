namespace PetitesAnnonces.Api.Models;

public enum ReportReason
{
    Spam,
    Inapproprie,
    Interdit,
    Autre,
}

public enum ReportStatus
{
    Pending,
    Reviewed,
    Dismissed,
}

/// <summary>
/// Signalement d'une annonce par un membre du groupe — modération communautaire en
/// complément (pas en remplacement) du panneau admin existant.
/// </summary>
public class Report
{
    public int Id { get; set; }

    public int ListingId { get; set; }

    public Listing? Listing { get; set; }

    public required string ReporterUserId { get; set; }

    public ReportReason Reason { get; set; }

    public string? Details { get; set; }

    public ReportStatus Status { get; set; } = ReportStatus.Pending;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? ReviewedAt { get; set; }

    public string? ReviewedByAdminUserId { get; set; }
}

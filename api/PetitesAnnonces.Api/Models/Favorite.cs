namespace PetitesAnnonces.Api.Models;

/// <summary>Annonce marquée comme favorite par un utilisateur (spec Phase 9).</summary>
public class Favorite
{
    public int Id { get; set; }

    public required string UserId { get; set; }

    public int ListingId { get; set; }

    public Listing? Listing { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

namespace PetitesAnnonces.Api.Models;

/// <summary>
/// Annonce déposée par un membre dans un de ses groupes. Visible uniquement des membres
/// de ce groupe (voir <see cref="Auth.GroupMembershipAuthorizationHandler"/>).
/// </summary>
public class Listing
{
    public int Id { get; set; }

    public required string Title { get; set; }

    public string? Description { get; set; }

    /// <summary>Non nul uniquement pour <see cref="ListingMode.Sale"/>.</summary>
    public decimal? Price { get; set; }

    public ListingMode Mode { get; set; }

    public int CategoryId { get; set; }

    public Category? Category { get; set; }

    public ListingStatus Status { get; set; } = ListingStatus.Available;

    public int GroupId { get; set; }

    public Group? Group { get; set; }

    public required string AuthorUserId { get; set; }

    public ContactMode ContactMode { get; set; }

    /// <summary>Coordonnées affichées, requises quand <see cref="ContactMode.DirectContact"/> est choisi.</summary>
    public string? ContactDetails { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<ListingImage> Images { get; set; } = [];
}

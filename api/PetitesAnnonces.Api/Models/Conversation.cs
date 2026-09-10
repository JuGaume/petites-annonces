namespace PetitesAnnonces.Api.Models;

/// <summary>
/// Fil de discussion entre l'auteur d'une annonce (vendeur) et une personne intéressée
/// (acheteur), quand l'annonce a choisi <see cref="ContactMode.InternalMessaging"/>. Un
/// seul acheteur ne peut avoir qu'une conversation par annonce.
/// </summary>
public class Conversation
{
    public int Id { get; set; }

    public int ListingId { get; set; }

    public Listing? Listing { get; set; }

    public required string BuyerUserId { get; set; }

    public required string SellerUserId { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<Message> Messages { get; set; } = [];
}

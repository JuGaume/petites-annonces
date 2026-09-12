namespace PetitesAnnonces.Api.Models;

/// <summary>
/// Recherche enregistrée par un membre dans un groupe. Le digest quotidien
/// (<see cref="Notifications.DigestBuilder"/>) alerte par email sur les nouvelles
/// annonces disponibles qui correspondent, depuis <see cref="LastNotifiedAt"/> — même
/// logique que <see cref="GroupMembership.LastDigestSentAt"/> pour le digest de groupe.
/// </summary>
public class SavedSearch
{
    public int Id { get; set; }

    public required string UserId { get; set; }

    public int GroupId { get; set; }

    public Group? Group { get; set; }

    /// <summary>Libellé affiché, choisi par l'utilisateur à la création (ex. "Meubles à moins de 50 €").</summary>
    public required string Label { get; set; }

    public int? CategoryId { get; set; }

    public string? Search { get; set; }

    public decimal? MinPrice { get; set; }

    public decimal? MaxPrice { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset LastNotifiedAt { get; set; } = DateTimeOffset.UtcNow;
}

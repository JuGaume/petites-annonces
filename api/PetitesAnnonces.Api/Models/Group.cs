namespace PetitesAnnonces.Api.Models;

/// <summary>
/// Groupe privé au sein duquel des annonces sont partagées. Étanche : seuls ses
/// membres (<see cref="GroupMembership"/>) voient son contenu.
/// </summary>
public class Group
{
    public int Id { get; set; }

    public required string Name { get; set; }

    public string? Description { get; set; }

    /// <summary>Clé interne de stockage de l'image du groupe (spec Phase 9), <c>null</c> si aucune n'a été déposée.</summary>
    public string? ImageStoragePath { get; set; }

    public string? ImageUrl { get; set; }

    public required string CreatedByUserId { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<GroupMembership> Memberships { get; set; } = [];
}

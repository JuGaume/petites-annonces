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

    public required string CreatedByUserId { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<GroupMembership> Memberships { get; set; } = [];
}

namespace PetitesAnnonces.Api.Models;

/// <summary>Journal minimal des actions de modération (spec §11, interface admin).</summary>
public class AuditLogEntry
{
    public int Id { get; set; }

    public required string AdminUserId { get; set; }

    /// <summary>Nom court de l'action, ex. "DisableUser", "DeleteGroup", "CreateCategory".</summary>
    public required string Action { get; set; }

    /// <summary>Identifiant de la ressource visée (userId, groupId, listingId, categoryId...), le cas échéant.</summary>
    public string? TargetId { get; set; }

    /// <summary>Détail lisible pour l'affichage (ex. nom du groupe supprimé).</summary>
    public string? Details { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

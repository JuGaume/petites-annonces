namespace PetitesAnnonces.Api.Models;

/// <summary>
/// Appartenance d'un utilisateur à un groupe. Le rôle est local au groupe (distinct des
/// rôles globaux <see cref="Roles"/>) : le créateur d'un groupe en est <see
/// cref="GroupMemberRole.Admin"/>, les personnes qui le rejoignent ensuite en sont
/// <see cref="GroupMemberRole.Member"/>.
/// </summary>
public class GroupMembership
{
    public int Id { get; set; }

    public int GroupId { get; set; }

    public Group? Group { get; set; }

    public required string UserId { get; set; }

    public GroupMemberRole Role { get; set; } = GroupMemberRole.Member;

    public DateTimeOffset JoinedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>Désabonnement possible par groupe du digest quotidien (Phase 5).</summary>
    public bool EmailDigestEnabled { get; set; } = true;

    /// <summary>
    /// Dernier envoi du digest pour ce membre dans ce groupe. Sert de point de départ
    /// pour sélectionner les annonces "nouvelles" du prochain envoi ; <see
    /// cref="JoinedAt"/> sert de repère initial tant qu'aucun digest n'a encore été
    /// envoyé, pour ne jamais notifier de l'historique complet du groupe.
    /// </summary>
    public DateTimeOffset? LastDigestSentAt { get; set; }
}

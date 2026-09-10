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
}

namespace PetitesAnnonces.Api.Contracts;

public record CreateGroupRequest(string Name, string? Description);

public record GroupResponse(
    int Id,
    string Name,
    string? Description,
    string? ImageUrl,
    string CreatedByUserId,
    DateTimeOffset CreatedAt,
    int MemberCount,
    string CurrentUserRole,
    bool EmailDigestEnabled,
    // Miniatures des annonces disponibles les plus récentes du groupe (spec Phase 9),
    // pour un aperçu sur la liste des groupes.
    IReadOnlyList<string> ListingPreviewUrls,
    // Droits effectifs de l'appelant dans ce groupe (spec Phase 10) : toujours vrais
    // pour un admin, sinon reflètent les droits accordés individuellement.
    bool CurrentUserCanInviteMembers,
    bool CurrentUserCanRemoveMembers,
    bool CurrentUserCanDeleteListings);

public record UpdateGroupNotificationPreferenceRequest(bool EmailDigestEnabled);

public record GroupMemberResponse(
    string UserId,
    string DisplayName,
    string Email,
    string Role,
    DateTimeOffset JoinedAt,
    bool CanInviteMembers,
    bool CanRemoveMembers,
    bool CanDeleteListings);

/// <summary>Change le rôle local au groupe d'un membre (spec Phase 10). "Admin" ou "Member".</summary>
public record UpdateMemberRoleRequest(string Role);

/// <summary>
/// Droits accordés individuellement à un membre simple (spec Phase 10) — sans effet sur
/// un admin, qui les a tous implicitement.
/// </summary>
public record UpdateMemberPermissionsRequest(bool CanInviteMembers, bool CanRemoveMembers, bool CanDeleteListings);

public record CreateEmailInvitationRequest(string Email);

public record InvitationResponse(
    int Id,
    int GroupId,
    string Token,
    string Type,
    string? TargetEmail,
    DateTimeOffset? ExpiresAt,
    bool IsActive);

/// <summary>Aperçu public (non authentifié) d'une invitation, pour la page « Rejoindre le groupe ».</summary>
public record InvitationPreviewResponse(string GroupName, string Type, bool IsValid);

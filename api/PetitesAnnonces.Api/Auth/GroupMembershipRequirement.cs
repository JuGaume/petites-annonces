using Microsoft.AspNetCore.Authorization;

namespace PetitesAnnonces.Api.Auth;

/// <summary>Exige l'appartenance au groupe désigné par le segment de route "groupId".</summary>
public class GroupMembershipRequirement(bool requireAdmin) : IAuthorizationRequirement
{
    public bool RequireAdmin { get; } = requireAdmin;
}

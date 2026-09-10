using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using PetitesAnnonces.Api.Data;
using PetitesAnnonces.Api.Models;

namespace PetitesAnnonces.Api.Auth;

/// <summary>
/// Vérifie que l'utilisateur courant appartient au groupe désigné par le segment de
/// route "groupId" (et, si requis, qu'il y est admin). Filtre d'autorisation destiné à
/// être réutilisé par toutes les fonctionnalités scopées à un groupe dans les phases
/// suivantes (annonces, messagerie, ...), pour garantir l'étanchéité entre groupes.
/// </summary>
public class GroupMembershipAuthorizationHandler(IHttpContextAccessor httpContextAccessor, ApplicationDbContext db)
    : AuthorizationHandler<GroupMembershipRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        GroupMembershipRequirement requirement)
    {
        var groupId = GetGroupIdFromRoute();
        if (groupId is null)
        {
            return;
        }

        var userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userId is null)
        {
            return;
        }

        var membership = await db.GroupMemberships
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.GroupId == groupId && m.UserId == userId);

        if (membership is null)
        {
            return;
        }

        if (requirement.RequireAdmin && membership.Role != GroupMemberRole.Admin)
        {
            return;
        }

        context.Succeed(requirement);
    }

    private int? GetGroupIdFromRoute()
    {
        var routeValues = httpContextAccessor.HttpContext?.Request.RouteValues;
        if (routeValues is null || !routeValues.TryGetValue("groupId", out var raw))
        {
            return null;
        }

        return int.TryParse(raw?.ToString(), out var groupId) ? groupId : null;
    }
}

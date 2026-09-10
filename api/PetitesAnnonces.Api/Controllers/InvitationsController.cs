using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PetitesAnnonces.Api.Contracts;
using PetitesAnnonces.Api.Data;
using PetitesAnnonces.Api.Models;

namespace PetitesAnnonces.Api.Controllers;

/// <summary>
/// Consultation et acceptation d'une invitation via son token. Séparé de
/// <see cref="GroupsController"/> car ces routes ne sont pas scopées à un groupe dont
/// l'appelant est déjà membre (l'aperçu est même accessible sans authentification, pour
/// afficher « Rejoindre le groupe X » avant inscription).
/// </summary>
[ApiController]
[Route("invitations")]
public class InvitationsController(ApplicationDbContext db, UserManager<ApplicationUser> userManager) : ControllerBase
{
    [HttpGet("{token}")]
    [AllowAnonymous]
    public async Task<ActionResult<InvitationPreviewResponse>> Preview(string token)
    {
        var invitation = await db.GroupInvitations
            .AsNoTracking()
            .Include(i => i.Group)
            .FirstOrDefaultAsync(i => i.Token == token);

        if (invitation?.Group is null)
        {
            return NotFound();
        }

        return new InvitationPreviewResponse(invitation.Group.Name, invitation.Type.ToString(), invitation.IsActive);
    }

    [HttpPost("{token}/accept")]
    [Authorize]
    public async Task<ActionResult<GroupResponse>> Accept(string token)
    {
        var invitation = await db.GroupInvitations
            .Include(i => i.Group)
            .FirstOrDefaultAsync(i => i.Token == token);

        if (invitation?.Group is null)
        {
            return NotFound(new { message = "Invitation introuvable." });
        }

        if (!invitation.IsActive)
        {
            return BadRequest(new { message = "Cette invitation n'est plus valide." });
        }

        var user = await userManager.GetUserAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }

        // Invitation nominative : seule la personne visée peut l'accepter, même si le
        // token venait à être partagé.
        if (invitation.Type == GroupInvitationType.Email
            && !string.Equals(user.Email, invitation.TargetEmail, StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        var alreadyMember = await db.GroupMemberships
            .AnyAsync(m => m.GroupId == invitation.GroupId && m.UserId == user.Id);

        if (!alreadyMember)
        {
            db.GroupMemberships.Add(new GroupMembership
            {
                GroupId = invitation.GroupId,
                UserId = user.Id,
                Role = GroupMemberRole.Member,
            });
        }

        if (invitation.Type == GroupInvitationType.Email)
        {
            invitation.UsedAt = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync();

        var memberCount = await db.GroupMemberships.CountAsync(m => m.GroupId == invitation.GroupId);
        var membership = await db.GroupMemberships
            .Where(m => m.GroupId == invitation.GroupId && m.UserId == user.Id)
            .Select(m => new { m.Role, m.EmailDigestEnabled })
            .FirstAsync();

        // Aperçu d'annonces (ListingPreviewUrls) omis ici pour rester simple : la liste
        // complète des groupes (GroupsController.Mine) le renverra au prochain chargement.
        return new GroupResponse(
            invitation.Group.Id,
            invitation.Group.Name,
            invitation.Group.Description,
            invitation.Group.ImageUrl,
            invitation.Group.CreatedByUserId,
            invitation.Group.CreatedAt,
            memberCount,
            membership.Role.ToString(),
            membership.EmailDigestEnabled,
            ListingPreviewUrls: []);
    }
}

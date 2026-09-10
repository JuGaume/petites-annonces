using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PetitesAnnonces.Api.Auth;
using PetitesAnnonces.Api.Contracts;
using PetitesAnnonces.Api.Data;
using PetitesAnnonces.Api.Email;
using PetitesAnnonces.Api.Models;

namespace PetitesAnnonces.Api.Controllers;

[ApiController]
[Route("groups")]
[Authorize]
public class GroupsController(
    ApplicationDbContext db,
    IEmailSender emailSender,
    IConfiguration configuration) : ControllerBase
{
    private const int MaxNameLength = 120;
    private const int MaxDescriptionLength = 500;

    private string CurrentUserId => User.FindFirst(ClaimTypes.NameIdentifier)!.Value;

    [HttpPost]
    public async Task<ActionResult<GroupResponse>> Create(CreateGroupRequest request)
    {
        var name = request.Name?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(name))
        {
            return ValidationProblem("Le nom du groupe est requis.");
        }

        if (name.Length > MaxNameLength)
        {
            return ValidationProblem($"Le nom du groupe ne peut pas dépasser {MaxNameLength} caractères.");
        }

        var description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        if (description is { Length: > MaxDescriptionLength })
        {
            return ValidationProblem($"La description ne peut pas dépasser {MaxDescriptionLength} caractères.");
        }

        var group = new Group
        {
            Name = name,
            Description = description,
            CreatedByUserId = CurrentUserId,
        };
        db.Groups.Add(group);
        db.GroupMemberships.Add(new GroupMembership
        {
            Group = group,
            UserId = CurrentUserId,
            Role = GroupMemberRole.Admin,
        });

        await db.SaveChangesAsync();

        return new GroupResponse(group.Id, group.Name, group.Description, group.CreatedByUserId, group.CreatedAt, MemberCount: 1, GroupMemberRole.Admin.ToString(), EmailDigestEnabled: true);
    }

    [HttpGet]
    public async Task<ActionResult<List<GroupResponse>>> Mine()
    {
        var userId = CurrentUserId;

        var groups = await db.GroupMemberships
            .AsNoTracking()
            .Where(m => m.UserId == userId)
            .Select(m => new GroupResponse(
                m.Group!.Id,
                m.Group.Name,
                m.Group.Description,
                m.Group.CreatedByUserId,
                m.Group.CreatedAt,
                m.Group.Memberships.Count,
                m.Role.ToString(),
                m.EmailDigestEnabled))
            .ToListAsync();

        return groups;
    }

    [HttpGet("{groupId:int}")]
    [Authorize(Policy = GroupPolicies.Member)]
    public async Task<ActionResult<GroupResponse>> Get(int groupId)
    {
        var response = await GetGroupResponseAsync(groupId, CurrentUserId);
        return response is null ? NotFound() : response;
    }

    [HttpGet("{groupId:int}/members")]
    [Authorize(Policy = GroupPolicies.Member)]
    public async Task<ActionResult<List<GroupMemberResponse>>> Members(int groupId)
    {
        // Trier avant la projection en GroupMemberResponse : une fois le Join projeté
        // directement dans le record de réponse, EF Core ne sait plus retraduire un
        // OrderBy ultérieur en SQL (échoue sur SQL Server, contrairement au fournisseur
        // InMemory utilisé par les tests — voir le correctif équivalent sur ListingsController).
        var members = await db.GroupMemberships
            .AsNoTracking()
            .Where(m => m.GroupId == groupId)
            .OrderBy(m => m.JoinedAt)
            .Join(db.Users, m => m.UserId, u => u.Id, (m, u) => new GroupMemberResponse(
                u.Id, u.DisplayName, u.Email!, m.Role.ToString(), m.JoinedAt))
            .ToListAsync();

        return members;
    }

    [HttpPatch("{groupId:int}/notifications")]
    [Authorize(Policy = GroupPolicies.Member)]
    public async Task<IActionResult> UpdateNotificationPreference(int groupId, UpdateGroupNotificationPreferenceRequest request)
    {
        var membership = await db.GroupMemberships
            .FirstOrDefaultAsync(m => m.GroupId == groupId && m.UserId == CurrentUserId);
        if (membership is null)
        {
            return NotFound();
        }

        membership.EmailDigestEnabled = request.EmailDigestEnabled;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{groupId:int}/invitations/link")]
    [Authorize(Policy = GroupPolicies.Admin)]
    public async Task<ActionResult<InvitationResponse>> GetOrCreateLinkInvitation(int groupId)
    {
        var invitation = await db.GroupInvitations
            .Where(i => i.GroupId == groupId
                && i.Type == GroupInvitationType.Link
                && i.RevokedAt == null
                && (i.ExpiresAt == null || i.ExpiresAt > DateTimeOffset.UtcNow))
            .OrderByDescending(i => i.CreatedAt)
            .FirstOrDefaultAsync();

        if (invitation is null)
        {
            invitation = new GroupInvitation
            {
                GroupId = groupId,
                Type = GroupInvitationType.Link,
                Token = SecureTokenGenerator.Generate(),
                CreatedByUserId = CurrentUserId,
            };
            db.GroupInvitations.Add(invitation);
            await db.SaveChangesAsync();
        }

        return ToInvitationResponse(invitation);
    }

    [HttpPost("{groupId:int}/invitations/link/revoke")]
    [Authorize(Policy = GroupPolicies.Admin)]
    public async Task<IActionResult> RevokeLinkInvitation(int groupId)
    {
        var activeLinks = await db.GroupInvitations
            .Where(i => i.GroupId == groupId && i.Type == GroupInvitationType.Link && i.RevokedAt == null)
            .ToListAsync();

        foreach (var invitation in activeLinks)
        {
            invitation.RevokedAt = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{groupId:int}/invitations/email")]
    [Authorize(Policy = GroupPolicies.Admin)]
    public async Task<ActionResult<InvitationResponse>> InviteByEmail(int groupId, CreateEmailInvitationRequest request)
    {
        var email = request.Email?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(email) || !new EmailAddressAttribute().IsValid(email))
        {
            return ValidationProblem("Adresse email invalide.");
        }

        var group = await db.Groups.AsNoTracking().FirstOrDefaultAsync(g => g.Id == groupId);
        if (group is null)
        {
            return NotFound();
        }

        var invitation = new GroupInvitation
        {
            GroupId = groupId,
            Type = GroupInvitationType.Email,
            Token = SecureTokenGenerator.Generate(),
            TargetEmail = email,
            CreatedByUserId = CurrentUserId,
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(7),
        };
        db.GroupInvitations.Add(invitation);
        await db.SaveChangesAsync();

        var joinUrl = BuildJoinUrl(invitation.Token);
        await emailSender.SendAsync(
            email,
            $"Invitation à rejoindre le groupe « {group.Name} »",
            $"""
            <p>Vous avez été invité·e à rejoindre le groupe <strong>{System.Net.WebUtility.HtmlEncode(group.Name)}</strong> sur Petites annonces.</p>
            <p><a href="{joinUrl}">Rejoindre le groupe</a></p>
            <p>Ce lien expire le {invitation.ExpiresAt:d} et ne peut être utilisé qu'une seule fois.</p>
            """);

        return ToInvitationResponse(invitation);
    }

    private string BuildJoinUrl(string token)
    {
        var baseUrl = (configuration["Frontend:BaseUrl"] ?? "http://localhost:5173").TrimEnd('/');
        return $"{baseUrl}/join/{token}";
    }

    private async Task<GroupResponse?> GetGroupResponseAsync(int groupId, string userId)
    {
        return await db.GroupMemberships
            .AsNoTracking()
            .Where(m => m.GroupId == groupId && m.UserId == userId)
            .Select(m => new GroupResponse(
                m.Group!.Id,
                m.Group.Name,
                m.Group.Description,
                m.Group.CreatedByUserId,
                m.Group.CreatedAt,
                m.Group.Memberships.Count,
                m.Role.ToString(),
                m.EmailDigestEnabled))
            .FirstOrDefaultAsync();
    }

    private static InvitationResponse ToInvitationResponse(GroupInvitation invitation) => new(
        invitation.Id,
        invitation.GroupId,
        invitation.Token,
        invitation.Type.ToString(),
        invitation.TargetEmail,
        invitation.ExpiresAt,
        invitation.IsActive);
}

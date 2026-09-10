using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PetitesAnnonces.Api.Auth;
using PetitesAnnonces.Api.Contracts;
using PetitesAnnonces.Api.Data;
using PetitesAnnonces.Api.Email;
using PetitesAnnonces.Api.Images;
using PetitesAnnonces.Api.Models;
using PetitesAnnonces.Api.Storage;

namespace PetitesAnnonces.Api.Controllers;

[ApiController]
[Route("groups")]
[Authorize]
public class GroupsController(
    ApplicationDbContext db,
    IEmailSender emailSender,
    IConfiguration configuration,
    IBlobStorageService blobStorage) : ControllerBase
{
    private const int MaxNameLength = 120;
    private const int MaxDescriptionLength = 500;
    private const int MaxPreviewsPerGroup = 4;
    private const long MaxImageBytes = 5 * 1024 * 1024;
    private static readonly string[] AllowedImageContentTypes = ["image/jpeg", "image/png", "image/webp"];

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

        // Le créateur est admin (droits complets, voir plus bas) : pas besoin des trois
        // derniers booléens pour lui, mais le contrat les attend toujours.
        return new GroupResponse(
            group.Id, group.Name, group.Description, group.ImageUrl, group.CreatedByUserId, group.CreatedAt,
            MemberCount: 1, GroupMemberRole.Admin.ToString(), EmailDigestEnabled: true, ListingPreviewUrls: [],
            CurrentUserCanInviteMembers: true, CurrentUserCanRemoveMembers: true, CurrentUserCanDeleteListings: true);
    }

    [HttpGet]
    public async Task<ActionResult<List<GroupResponse>>> Mine()
    {
        var userId = CurrentUserId;

        var memberships = await db.GroupMemberships
            .AsNoTracking()
            .Where(m => m.UserId == userId)
            .Select(m => new
            {
                m.Group!.Id,
                m.Group.Name,
                m.Group.Description,
                m.Group.ImageUrl,
                m.Group.CreatedByUserId,
                m.Group.CreatedAt,
                MemberCount = m.Group.Memberships.Count,
                m.Role,
                m.EmailDigestEnabled,
                m.CanInviteMembers,
                m.CanRemoveMembers,
                m.CanDeleteListings,
            })
            .ToListAsync();

        var previewsByGroup = await GetListingPreviewsByGroupAsync(memberships.Select(m => m.Id).ToList());

        return memberships
            .Select(m => new GroupResponse(
                m.Id,
                m.Name,
                m.Description,
                m.ImageUrl,
                m.CreatedByUserId,
                m.CreatedAt,
                m.MemberCount,
                m.Role.ToString(),
                m.EmailDigestEnabled,
                previewsByGroup.TryGetValue(m.Id, out var urls) ? urls : [],
                CurrentUserCanInviteMembers: m.Role == GroupMemberRole.Admin || m.CanInviteMembers,
                CurrentUserCanRemoveMembers: m.Role == GroupMemberRole.Admin || m.CanRemoveMembers,
                CurrentUserCanDeleteListings: m.Role == GroupMemberRole.Admin || m.CanDeleteListings))
            .ToList();
    }

    [HttpPost("{groupId:int}/image")]
    [Authorize(Policy = GroupPolicies.Admin)]
    [RequestSizeLimit(MaxImageBytes + 1024 * 1024)]
    public async Task<ActionResult<GroupResponse>> UploadImage(int groupId, IFormFile image)
    {
        if (image is null || image.Length == 0)
        {
            return ValidationProblem("Aucune image reçue.");
        }

        if (!AllowedImageContentTypes.Contains(image.ContentType, StringComparer.OrdinalIgnoreCase))
        {
            return ValidationProblem("Type de fichier non autorisé (jpeg, png ou webp uniquement).");
        }

        if (image.Length > MaxImageBytes)
        {
            return ValidationProblem("L'image doit faire moins de 5 Mo.");
        }

        var group = await db.Groups.FirstOrDefaultAsync(g => g.Id == groupId);
        if (group is null)
        {
            return NotFound();
        }

        var previousStoragePath = group.ImageStoragePath;

        await using var stream = image.OpenReadStream();
        using var resized = await ThumbnailGenerator.CreateOptimizedOriginalAsync(stream);
        var stored = await blobStorage.SaveAsync(resized, image.FileName, ThumbnailGenerator.OptimizedContentType);

        group.ImageStoragePath = stored.StoragePath;
        group.ImageUrl = stored.Url;
        await db.SaveChangesAsync();

        if (previousStoragePath is not null)
        {
            await blobStorage.DeleteAsync(previousStoragePath);
        }

        var response = await GetGroupResponseAsync(groupId, CurrentUserId);
        return response is null ? NotFound() : response;
    }

    [HttpDelete("{groupId:int}/image")]
    [Authorize(Policy = GroupPolicies.Admin)]
    public async Task<IActionResult> DeleteImage(int groupId)
    {
        var group = await db.Groups.FirstOrDefaultAsync(g => g.Id == groupId);
        if (group is null)
        {
            return NotFound();
        }

        if (group.ImageStoragePath is not null)
        {
            await blobStorage.DeleteAsync(group.ImageStoragePath);
            group.ImageStoragePath = null;
            group.ImageUrl = null;
            await db.SaveChangesAsync();
        }

        return NoContent();
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
                u.Id, u.DisplayName, u.Email!, m.Role.ToString(), m.JoinedAt,
                m.CanInviteMembers, m.CanRemoveMembers, m.CanDeleteListings))
            .ToListAsync();

        return members;
    }

    [HttpPatch("{groupId:int}/members/{userId}/role")]
    [Authorize(Policy = GroupPolicies.Admin)]
    public async Task<IActionResult> UpdateMemberRole(int groupId, string userId, UpdateMemberRoleRequest request)
    {
        if (!Enum.TryParse<GroupMemberRole>(request.Role, ignoreCase: true, out var role))
        {
            return ValidationProblem("Rôle invalide (Admin ou Member attendu).");
        }

        var group = await db.Groups.AsNoTracking().FirstOrDefaultAsync(g => g.Id == groupId);
        if (group is null)
        {
            return NotFound();
        }

        // Le créateur reste admin en permanence : sans ça, un groupe pourrait se
        // retrouver sans aucun admin (personne pour re-promouvoir qui que ce soit).
        if (group.CreatedByUserId == userId)
        {
            return ValidationProblem("Le créateur du groupe reste toujours administrateur.");
        }

        var membership = await db.GroupMemberships.FirstOrDefaultAsync(m => m.GroupId == groupId && m.UserId == userId);
        if (membership is null)
        {
            return NotFound();
        }

        if (membership.Role == GroupMemberRole.Admin && role != GroupMemberRole.Admin)
        {
            var otherAdminExists = await db.GroupMemberships
                .AnyAsync(m => m.GroupId == groupId && m.UserId != userId && m.Role == GroupMemberRole.Admin);
            if (!otherAdminExists)
            {
                return ValidationProblem("Impossible de rétrograder le dernier administrateur du groupe.");
            }
        }

        membership.Role = role;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPatch("{groupId:int}/members/{userId}/permissions")]
    [Authorize(Policy = GroupPolicies.Admin)]
    public async Task<IActionResult> UpdateMemberPermissions(int groupId, string userId, UpdateMemberPermissionsRequest request)
    {
        var membership = await db.GroupMemberships.FirstOrDefaultAsync(m => m.GroupId == groupId && m.UserId == userId);
        if (membership is null)
        {
            return NotFound();
        }

        if (membership.Role == GroupMemberRole.Admin)
        {
            return ValidationProblem("Un administrateur a déjà tous les droits, inutile de les lui accorder individuellement.");
        }

        membership.CanInviteMembers = request.CanInviteMembers;
        membership.CanRemoveMembers = request.CanRemoveMembers;
        membership.CanDeleteListings = request.CanDeleteListings;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{groupId:int}/members/{userId}")]
    [Authorize(Policy = GroupPolicies.Member)]
    public async Task<IActionResult> RemoveMember(int groupId, string userId)
    {
        if (userId == CurrentUserId)
        {
            return ValidationProblem("Vous ne pouvez pas vous retirer vous-même du groupe.");
        }

        var caller = await db.GroupMemberships.AsNoTracking()
            .FirstOrDefaultAsync(m => m.GroupId == groupId && m.UserId == CurrentUserId);
        if (caller is null)
        {
            return NotFound();
        }

        var target = await db.GroupMemberships.FirstOrDefaultAsync(m => m.GroupId == groupId && m.UserId == userId);
        if (target is null)
        {
            return NotFound();
        }

        // Seul un admin peut retirer un autre admin — un membre disposant uniquement de
        // CanRemoveMembers ne peut agir que sur des membres simples.
        var canRemoveTarget = caller.Role == GroupMemberRole.Admin
            || (caller.CanRemoveMembers && target.Role != GroupMemberRole.Admin);
        if (!canRemoveTarget)
        {
            return Forbid();
        }

        var group = await db.Groups.AsNoTracking().FirstOrDefaultAsync(g => g.Id == groupId);
        if (group?.CreatedByUserId == userId)
        {
            return ValidationProblem("Le créateur du groupe ne peut pas être retiré.");
        }

        db.GroupMemberships.Remove(target);
        await db.SaveChangesAsync();
        return NoContent();
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
    [Authorize(Policy = GroupPolicies.Member)]
    public async Task<ActionResult<InvitationResponse>> GetOrCreateLinkInvitation(int groupId)
    {
        if (!await CanInviteAsync(groupId))
        {
            return Forbid();
        }

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
    [Authorize(Policy = GroupPolicies.Member)]
    public async Task<IActionResult> RevokeLinkInvitation(int groupId)
    {
        if (!await CanInviteAsync(groupId))
        {
            return Forbid();
        }

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
    [Authorize(Policy = GroupPolicies.Member)]
    public async Task<ActionResult<InvitationResponse>> InviteByEmail(int groupId, CreateEmailInvitationRequest request)
    {
        if (!await CanInviteAsync(groupId))
        {
            return Forbid();
        }

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

    /// <summary>Admin, ou membre simple ayant reçu le droit d'inviter (spec Phase 10).</summary>
    private async Task<bool> CanInviteAsync(int groupId)
    {
        var membership = await db.GroupMemberships.AsNoTracking()
            .FirstOrDefaultAsync(m => m.GroupId == groupId && m.UserId == CurrentUserId);
        return membership is not null && (membership.Role == GroupMemberRole.Admin || membership.CanInviteMembers);
    }

    private string BuildJoinUrl(string token)
    {
        var baseUrl = (configuration["Frontend:BaseUrl"] ?? "http://localhost:5173").TrimEnd('/');
        return $"{baseUrl}/join/{token}";
    }

    private async Task<GroupResponse?> GetGroupResponseAsync(int groupId, string userId)
    {
        var membership = await db.GroupMemberships
            .AsNoTracking()
            .Where(m => m.GroupId == groupId && m.UserId == userId)
            .Select(m => new
            {
                m.Group!.Id,
                m.Group.Name,
                m.Group.Description,
                m.Group.ImageUrl,
                m.Group.CreatedByUserId,
                m.Group.CreatedAt,
                MemberCount = m.Group.Memberships.Count,
                m.Role,
                m.EmailDigestEnabled,
                m.CanInviteMembers,
                m.CanRemoveMembers,
                m.CanDeleteListings,
            })
            .FirstOrDefaultAsync();

        if (membership is null)
        {
            return null;
        }

        var previewsByGroup = await GetListingPreviewsByGroupAsync([membership.Id]);

        return new GroupResponse(
            membership.Id,
            membership.Name,
            membership.Description,
            membership.ImageUrl,
            membership.CreatedByUserId,
            membership.CreatedAt,
            membership.MemberCount,
            membership.Role.ToString(),
            membership.EmailDigestEnabled,
            previewsByGroup.TryGetValue(membership.Id, out var urls) ? urls : [],
            CurrentUserCanInviteMembers: membership.Role == GroupMemberRole.Admin || membership.CanInviteMembers,
            CurrentUserCanRemoveMembers: membership.Role == GroupMemberRole.Admin || membership.CanRemoveMembers,
            CurrentUserCanDeleteListings: membership.Role == GroupMemberRole.Admin || membership.CanDeleteListings);
    }

    /// <summary>
    /// Miniatures des annonces disponibles les plus récentes, par groupe (spec Phase 9,
    /// aperçu sur la liste des groupes) — une requête unique pour tous les groupes demandés
    /// plutôt qu'une par groupe.
    /// </summary>
    private async Task<Dictionary<int, List<string>>> GetListingPreviewsByGroupAsync(IReadOnlyCollection<int> groupIds)
    {
        if (groupIds.Count == 0)
        {
            return [];
        }

        // Trié avant la projection, comme partout ailleurs dans ce contrôleur (voir
        // Members()) : un OrderBy après coup ne se traduit pas en SQL sur SQL Server.
        var previews = await db.Listings
            .AsNoTracking()
            .Where(l => groupIds.Contains(l.GroupId) && l.Status == ListingStatus.Available)
            .OrderByDescending(l => l.CreatedAt)
            .Select(l => new
            {
                l.GroupId,
                ThumbnailUrl = l.Images.OrderBy(i => i.Position).Select(i => i.ThumbnailUrl).FirstOrDefault(),
            })
            .ToListAsync();

        // Regroupement et troncature en mémoire : LINQ to Objects est stable, l'ordre
        // décroissant par date posé ci-dessus est donc conservé au sein de chaque groupe.
        return previews
            .GroupBy(p => p.GroupId)
            .ToDictionary(
                g => g.Key,
                g => g.Select(p => p.ThumbnailUrl).Where(url => url is not null).Take(MaxPreviewsPerGroup).Select(url => url!).ToList());
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

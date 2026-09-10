using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PetitesAnnonces.Api.Auth;
using PetitesAnnonces.Api.Contracts;
using PetitesAnnonces.Api.Data;
using PetitesAnnonces.Api.Models;

namespace PetitesAnnonces.Api.Controllers;

/// <summary>
/// Annonces favorites d'un utilisateur (spec Phase 9). Basculer un favori reste scopé au
/// groupe de l'annonce (<see cref="GroupPolicies.Member"/>, même logique que les
/// conversations) ; la liste, elle, n'appartient à aucun groupe dans son adressage.
/// </summary>
[ApiController]
[Route("favorites")]
[Authorize]
public class FavoritesController(ApplicationDbContext db) : ControllerBase
{
    private string CurrentUserId => User.FindFirst(ClaimTypes.NameIdentifier)!.Value;

    [HttpPut("/groups/{groupId:int}/listings/{listingId:int}/favorite")]
    [Authorize(Policy = GroupPolicies.Member)]
    public async Task<IActionResult> Add(int groupId, int listingId)
    {
        var listingExists = await db.Listings.AsNoTracking().AnyAsync(l => l.Id == listingId && l.GroupId == groupId);
        if (!listingExists)
        {
            return NotFound();
        }

        var userId = CurrentUserId;
        // Idempotent : basculer un favori déjà présent ne doit pas échouer (double-clic,
        // requête rejouée après une coupure réseau...).
        var alreadyFavorite = await db.Favorites.AnyAsync(f => f.UserId == userId && f.ListingId == listingId);
        if (!alreadyFavorite)
        {
            db.Favorites.Add(new Favorite { UserId = userId, ListingId = listingId });
            await db.SaveChangesAsync();
        }

        return NoContent();
    }

    [HttpDelete("/groups/{groupId:int}/listings/{listingId:int}/favorite")]
    [Authorize(Policy = GroupPolicies.Member)]
    public async Task<IActionResult> Remove(int groupId, int listingId)
    {
        var userId = CurrentUserId;
        var favorite = await db.Favorites.FirstOrDefaultAsync(f => f.UserId == userId && f.ListingId == listingId);
        if (favorite is not null)
        {
            db.Favorites.Remove(favorite);
            await db.SaveChangesAsync();
        }

        return NoContent();
    }

    [HttpGet]
    public async Task<ActionResult<List<FavoriteListingResponse>>> Mine()
    {
        var userId = CurrentUserId;

        // Trié avant les jointures/la projection finale : un OrderBy après coup ne se
        // traduit pas en SQL sur SQL Server (voir le même correctif sur
        // ConversationsController.ConversationsQuery).
        var favorites = await db.Favorites
            .AsNoTracking()
            .Where(f => f.UserId == userId)
            .OrderByDescending(f => f.CreatedAt)
            .Join(db.Listings, f => f.ListingId, l => l.Id, (f, l) => new { Favorite = f, Listing = l })
            // Un favori peut survivre à un départ du groupe : on ne remonte que celles dont
            // l'utilisateur est toujours membre, pour ne pas exposer une annonce qu'il n'a
            // plus le droit de voir.
            .Where(x => db.GroupMemberships.Any(m => m.GroupId == x.Listing.GroupId && m.UserId == userId))
            .Join(db.Groups, x => x.Listing.GroupId, g => g.Id, (x, g) => new { x.Favorite, x.Listing, Group = g })
            .Select(x => new FavoriteListingResponse(
                x.Listing.Id,
                x.Listing.GroupId,
                x.Group.Name,
                x.Listing.Title,
                x.Listing.Price,
                x.Listing.Mode.ToString(),
                x.Listing.Status.ToString(),
                x.Listing.Images.OrderBy(i => i.Position).Select(i => i.ThumbnailUrl).FirstOrDefault(),
                x.Favorite.CreatedAt))
            .ToListAsync();

        return favorites;
    }
}

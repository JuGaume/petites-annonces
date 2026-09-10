using System.Security.Claims;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PetitesAnnonces.Api.Auth;
using PetitesAnnonces.Api.Contracts;
using PetitesAnnonces.Api.Data;
using PetitesAnnonces.Api.Images;
using PetitesAnnonces.Api.Models;
using PetitesAnnonces.Api.Storage;
using PetitesAnnonces.Api.Validation;

namespace PetitesAnnonces.Api.Controllers;

/// <summary>
/// CRUD des annonces, scopé au groupe de la route (<see cref="GroupPolicies.Member"/> —
/// même filtre d'autorisation que pour les groupes, garantissant l'étanchéité entre eux).
/// La mise à jour de statut et la suppression restent réservées à l'auteur de l'annonce.
/// </summary>
[ApiController]
[Route("groups/{groupId:int}/listings")]
[Authorize(Policy = GroupPolicies.Member)]
public class ListingsController(
    ApplicationDbContext db,
    IBlobStorageService blobStorage,
    IValidator<CreateListingRequest> createValidator) : ControllerBase
{
    private string CurrentUserId => User.FindFirst(ClaimTypes.NameIdentifier)!.Value;

    [HttpGet]
    public async Task<ActionResult<PagedResult<ListingSummaryResponse>>> List(
        int groupId,
        [FromQuery] int? categoryId,
        [FromQuery] ListingStatus? status,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var query = db.Listings.AsNoTracking().Where(l => l.GroupId == groupId);
        if (categoryId is not null)
        {
            query = query.Where(l => l.CategoryId == categoryId);
        }

        if (status is not null)
        {
            query = query.Where(l => l.Status == status);
        }

        var trimmedSearch = search?.Trim();
        if (!string.IsNullOrEmpty(trimmedSearch))
        {
            // .ToLower() des deux côtés plutôt que StringComparison.OrdinalIgnoreCase (non
            // traduisible en SQL) : donne un résultat insensible à la casse identique sur
            // SQL Server et sur le fournisseur InMemory des tests.
            var pattern = trimmedSearch.ToLower();
            query = query.Where(l =>
                l.Title.ToLower().Contains(pattern) || (l.Description != null && l.Description.ToLower().Contains(pattern)));
        }

        var currentUserId = CurrentUserId;
        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(l => l.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(l => new ListingSummaryResponse(
                l.Id,
                l.Title,
                l.Price,
                l.Mode.ToString(),
                l.Status.ToString(),
                l.Category!.Name,
                l.Images.OrderBy(i => i.Position).Select(i => i.ThumbnailUrl).FirstOrDefault(),
                l.CreatedAt,
                db.Favorites.Any(f => f.UserId == currentUserId && f.ListingId == l.Id)))
            .ToListAsync();

        return new PagedResult<ListingSummaryResponse>(items, page, pageSize, totalCount);
    }

    [HttpGet("{listingId:int}")]
    public async Task<ActionResult<ListingDetailResponse>> Get(int groupId, int listingId)
    {
        var listing = await DetailQuery(groupId, listingId).FirstOrDefaultAsync();
        return listing is null ? NotFound() : listing;
    }

    [HttpPost]
    [RequestSizeLimit(CreateListingRequestValidatorSizeLimit)]
    public async Task<ActionResult<ListingDetailResponse>> Create(int groupId, [FromForm] CreateListingRequest request)
    {
        var validation = await createValidator.ValidateAsync(request);
        if (!validation.IsValid)
        {
            foreach (var failure in validation.Errors)
            {
                ModelState.AddModelError(failure.PropertyName, failure.ErrorMessage);
            }

            return ValidationProblem(ModelState);
        }

        var listing = new Listing
        {
            Title = request.Title.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            Price = request.Mode == ListingMode.Sale ? request.Price : null,
            Mode = request.Mode,
            CategoryId = request.CategoryId,
            GroupId = groupId,
            AuthorUserId = CurrentUserId,
            ContactMode = request.ContactMode,
            ContactDetails = request.ContactMode == ContactMode.DirectContact ? request.ContactDetails?.Trim() : null,
        };
        db.Listings.Add(listing);
        await db.SaveChangesAsync();

        var position = 0;
        foreach (var image in request.Images)
        {
            await using var originalStream = image.OpenReadStream();
            using var optimizedStream = await ThumbnailGenerator.CreateOptimizedOriginalAsync(originalStream);
            var original = await blobStorage.SaveAsync(optimizedStream, image.FileName, ThumbnailGenerator.OptimizedContentType);

            await using var imageStreamForThumbnail = image.OpenReadStream();
            using var thumbnailStream = await ThumbnailGenerator.CreateAsync(imageStreamForThumbnail);
            var thumbnail = await blobStorage.SaveAsync(thumbnailStream, image.FileName, ThumbnailGenerator.ThumbnailContentType);

            db.ListingImages.Add(new ListingImage
            {
                ListingId = listing.Id,
                StoragePath = original.StoragePath,
                Url = original.Url,
                ThumbnailStoragePath = thumbnail.StoragePath,
                ThumbnailUrl = thumbnail.Url,
                Position = position++,
            });
        }

        await db.SaveChangesAsync();

        var created = await DetailQuery(groupId, listing.Id).FirstAsync();
        return CreatedAtAction(nameof(Get), new { groupId, listingId = listing.Id }, created);
    }

    [HttpPatch("{listingId:int}/status")]
    public async Task<ActionResult<ListingDetailResponse>> UpdateStatus(int groupId, int listingId, UpdateListingStatusRequest request)
    {
        var listing = await db.Listings.FirstOrDefaultAsync(l => l.Id == listingId && l.GroupId == groupId);
        if (listing is null)
        {
            return NotFound();
        }

        if (listing.AuthorUserId != CurrentUserId)
        {
            return Forbid();
        }

        listing.Status = request.Status;
        listing.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();

        return await DetailQuery(groupId, listingId).FirstAsync();
    }

    [HttpDelete("{listingId:int}")]
    public async Task<IActionResult> Delete(int groupId, int listingId)
    {
        var listing = await db.Listings
            .Include(l => l.Images)
            .FirstOrDefaultAsync(l => l.Id == listingId && l.GroupId == groupId);

        if (listing is null)
        {
            return NotFound();
        }

        if (listing.AuthorUserId != CurrentUserId && !await CanDeleteAnyListingAsync(groupId))
        {
            return Forbid();
        }

        foreach (var image in listing.Images)
        {
            await blobStorage.DeleteAsync(image.StoragePath);
            await blobStorage.DeleteAsync(image.ThumbnailStoragePath);
        }

        db.Listings.Remove(listing);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // Marge au-dessus de MaxImages * MaxImageBytes pour les autres champs du formulaire.
    private const long CreateListingRequestValidatorSizeLimit =
        CreateListingRequestValidator.MaxImages * CreateListingRequestValidator.MaxImageBytes + 1024 * 1024;

    /// <summary>Admin, ou membre simple ayant reçu le droit de supprimer n'importe quelle annonce (spec Phase 10).</summary>
    private async Task<bool> CanDeleteAnyListingAsync(int groupId)
    {
        var membership = await db.GroupMemberships.AsNoTracking()
            .FirstOrDefaultAsync(m => m.GroupId == groupId && m.UserId == CurrentUserId);
        return membership is not null && (membership.Role == GroupMemberRole.Admin || membership.CanDeleteListings);
    }

    private IQueryable<ListingDetailResponse> DetailQuery(int groupId, int? listingId = null)
    {
        var query = db.Listings.AsNoTracking().Where(l => l.GroupId == groupId);
        if (listingId is not null)
        {
            query = query.Where(l => l.Id == listingId);
        }

        var currentUserId = CurrentUserId;
        return query
            .Join(db.Users, l => l.AuthorUserId, u => u.Id, (l, u) => new { Listing = l, Author = u })
            .Select(x => new ListingDetailResponse(
                x.Listing.Id,
                x.Listing.Title,
                x.Listing.Description,
                x.Listing.Price,
                x.Listing.Mode.ToString(),
                x.Listing.Status.ToString(),
                x.Listing.CategoryId,
                x.Listing.Category!.Name,
                x.Listing.AuthorUserId,
                x.Author.DisplayName,
                x.Listing.ContactMode.ToString(),
                x.Listing.ContactDetails,
                x.Listing.CreatedAt,
                x.Listing.Images.OrderBy(i => i.Position)
                    .Select(i => new ListingImageResponse(i.Id, i.Url, i.ThumbnailUrl))
                    .ToList(),
                db.Favorites.Any(f => f.UserId == currentUserId && f.ListingId == x.Listing.Id)));
    }
}

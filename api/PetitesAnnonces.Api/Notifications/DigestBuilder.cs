using Microsoft.EntityFrameworkCore;
using PetitesAnnonces.Api.Data;
using PetitesAnnonces.Api.Models;

namespace PetitesAnnonces.Api.Notifications;

public class DigestBuilder(ApplicationDbContext db) : IDigestBuilder
{
    public async Task<IReadOnlyList<GroupDigest>> BuildPendingDigestsAsync(DateTimeOffset now, CancellationToken cancellationToken = default)
    {
        var memberships = await db.GroupMemberships
            .AsNoTracking()
            .Where(m => m.EmailDigestEnabled)
            .ToListAsync(cancellationToken);

        if (memberships.Count == 0)
        {
            return [];
        }

        var groupIds = memberships.Select(m => m.GroupId).Distinct().ToList();
        var userIds = memberships.Select(m => m.UserId).Distinct().ToList();

        var groups = await db.Groups.AsNoTracking()
            .Where(g => groupIds.Contains(g.Id))
            .ToDictionaryAsync(g => g.Id, cancellationToken);

        var users = await db.Users.AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, cancellationToken);

        var listings = await db.Listings.AsNoTracking()
            .Where(l => groupIds.Contains(l.GroupId))
            .Select(l => new
            {
                l.Id,
                l.GroupId,
                l.Title,
                l.Price,
                l.Mode,
                l.CreatedAt,
                l.AuthorUserId,
                ThumbnailUrl = l.Images.OrderBy(i => i.Position).Select(i => i.ThumbnailUrl).FirstOrDefault(),
            })
            .ToListAsync(cancellationToken);

        var listingsByGroup = listings.ToLookup(l => l.GroupId);

        var digests = new List<GroupDigest>();
        foreach (var membership in memberships)
        {
            if (!groups.TryGetValue(membership.GroupId, out var group) || !users.TryGetValue(membership.UserId, out var user))
            {
                continue;
            }

            // Repère de départ : le dernier digest envoyé, ou la date d'adhésion si
            // aucun digest n'a encore été envoyé — jamais l'historique complet du groupe.
            var since = membership.LastDigestSentAt ?? membership.JoinedAt;

            var newListings = listingsByGroup[membership.GroupId]
                .Where(l => l.CreatedAt > since && l.CreatedAt <= now && l.AuthorUserId != membership.UserId)
                .OrderBy(l => l.CreatedAt)
                .Select(l => new DigestListingItem(l.Id, l.Title, l.Price, l.Mode.ToString(), l.ThumbnailUrl))
                .ToList();

            if (newListings.Count == 0)
            {
                continue;
            }

            digests.Add(new GroupDigest(user.Id, user.Email!, user.DisplayName, membership.GroupId, group.Name, newListings));
        }

        return digests;
    }

    public async Task<IReadOnlyList<SavedSearchAlert>> BuildSavedSearchAlertsAsync(DateTimeOffset now, CancellationToken cancellationToken = default)
    {
        var savedSearches = await db.SavedSearches.AsNoTracking().ToListAsync(cancellationToken);
        if (savedSearches.Count == 0)
        {
            return [];
        }

        var groupIds = savedSearches.Select(s => s.GroupId).Distinct().ToList();
        var userIds = savedSearches.Select(s => s.UserId).Distinct().ToList();

        var groups = await db.Groups.AsNoTracking()
            .Where(g => groupIds.Contains(g.Id))
            .ToDictionaryAsync(g => g.Id, cancellationToken);

        var users = await db.Users.AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, cancellationToken);

        var listings = await db.Listings.AsNoTracking()
            .Where(l => groupIds.Contains(l.GroupId))
            .Select(l => new
            {
                l.Id,
                l.GroupId,
                l.Title,
                l.Price,
                l.Mode,
                l.CreatedAt,
                l.CategoryId,
                l.Status,
                ThumbnailUrl = l.Images.OrderBy(i => i.Position).Select(i => i.ThumbnailUrl).FirstOrDefault(),
            })
            .ToListAsync(cancellationToken);

        var listingsByGroup = listings.ToLookup(l => l.GroupId);

        var alerts = new List<SavedSearchAlert>();
        foreach (var savedSearch in savedSearches)
        {
            if (!groups.TryGetValue(savedSearch.GroupId, out var group) || !users.TryGetValue(savedSearch.UserId, out var user))
            {
                continue;
            }

            var pattern = savedSearch.Search?.Trim().ToLowerInvariant();

            var matches = listingsByGroup[savedSearch.GroupId]
                .Where(l => l.CreatedAt > savedSearch.LastNotifiedAt && l.CreatedAt <= now)
                .Where(l => l.Status == ListingStatus.Available)
                .Where(l => savedSearch.CategoryId is null || l.CategoryId == savedSearch.CategoryId)
                .Where(l => savedSearch.MinPrice is null || (l.Price is not null && l.Price >= savedSearch.MinPrice))
                .Where(l => savedSearch.MaxPrice is null || (l.Price is not null && l.Price <= savedSearch.MaxPrice))
                .Where(l => string.IsNullOrEmpty(pattern) || l.Title.ToLowerInvariant().Contains(pattern))
                .OrderBy(l => l.CreatedAt)
                .Select(l => new DigestListingItem(l.Id, l.Title, l.Price, l.Mode.ToString(), l.ThumbnailUrl))
                .ToList();

            if (matches.Count == 0)
            {
                continue;
            }

            alerts.Add(new SavedSearchAlert(
                savedSearch.Id, user.Id, user.Email!, user.DisplayName, savedSearch.GroupId, group.Name, savedSearch.Label, matches));
        }

        return alerts;
    }
}

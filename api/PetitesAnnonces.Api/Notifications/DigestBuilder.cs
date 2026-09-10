using Microsoft.EntityFrameworkCore;
using PetitesAnnonces.Api.Data;

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
}

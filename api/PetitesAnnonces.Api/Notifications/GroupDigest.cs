namespace PetitesAnnonces.Api.Notifications;

/// <summary>Annonce à inclure dans un digest.</summary>
public record DigestListingItem(int ListingId, string Title, decimal? Price, string Mode, string? ThumbnailUrl);

/// <summary>Digest à envoyer à un membre pour un groupe donné (voir <see cref="IDigestBuilder"/>).</summary>
public record GroupDigest(
    string UserId,
    string UserEmail,
    string UserDisplayName,
    int GroupId,
    string GroupName,
    IReadOnlyList<DigestListingItem> NewListings);

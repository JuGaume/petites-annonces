namespace PetitesAnnonces.Api.Models;

/// <summary>
/// Refresh token opaque associé à un utilisateur. Le token lui-même n'est jamais
/// stocké en clair : on ne persiste que son empreinte (hash) pour pouvoir le
/// révoquer/valider sans exposer de secret réutilisable si la base fuite.
/// </summary>
public class RefreshToken
{
    public int Id { get; set; }

    public required string UserId { get; set; }

    public required string TokenHash { get; set; }

    public DateTimeOffset ExpiresAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? RevokedAt { get; set; }

    public bool IsActive => RevokedAt is null && ExpiresAt > DateTimeOffset.UtcNow;
}

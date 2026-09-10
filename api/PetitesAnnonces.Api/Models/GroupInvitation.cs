namespace PetitesAnnonces.Api.Models;

/// <summary>
/// Invitation à rejoindre un groupe. Un lien (<see cref="GroupInvitationType.Link"/>)
/// est réutilisable par plusieurs personnes jusqu'à révocation ; une invitation par
/// email (<see cref="GroupInvitationType.Email"/>) cible <see cref="TargetEmail"/> et
/// n'est utilisable qu'une seule fois.
/// </summary>
public class GroupInvitation
{
    public int Id { get; set; }

    public int GroupId { get; set; }

    public Group? Group { get; set; }

    public GroupInvitationType Type { get; set; }

    public required string Token { get; set; }

    public string? TargetEmail { get; set; }

    public required string CreatedByUserId { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? ExpiresAt { get; set; }

    public DateTimeOffset? RevokedAt { get; set; }

    public DateTimeOffset? UsedAt { get; set; }

    public bool IsExpired => ExpiresAt is not null && ExpiresAt <= DateTimeOffset.UtcNow;

    public bool IsRevoked => RevokedAt is not null;

    // Seule l'invitation par email est à usage unique : un lien reste actif tant qu'il
    // n'est pas révoqué ou expiré, même après avoir servi.
    public bool IsUsed => Type == GroupInvitationType.Email && UsedAt is not null;

    public bool IsActive => !IsRevoked && !IsExpired && !IsUsed;
}

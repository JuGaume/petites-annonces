namespace PetitesAnnonces.Api.Email;

/// <summary>
/// Abstraction d'envoi d'email, réutilisée par les invitations de groupe (Phase 2) et
/// par le digest quotidien de notifications (Phase 5).
/// </summary>
public interface IEmailSender
{
    Task SendAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken = default);
}

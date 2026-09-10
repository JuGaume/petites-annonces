namespace PetitesAnnonces.Api.Email;

/// <summary>
/// Implémentation de secours pour le développement local et les tests : consigne
/// l'email dans les logs au lieu de l'envoyer réellement. Utilisée tant qu'aucune clé
/// SendGrid n'est configurée (voir l'enregistrement des services dans Program.cs).
/// </summary>
public class LoggingEmailSender(ILogger<LoggingEmailSender> logger) : IEmailSender
{
    public Task SendAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken = default)
    {
        logger.LogInformation(
            "[Email non envoyé — SendGrid non configuré] À: {ToEmail} — Objet: {Subject}\n{Body}",
            toEmail,
            subject,
            htmlBody);

        return Task.CompletedTask;
    }
}

namespace PetitesAnnonces.Api.Email;

public class SendGridOptions
{
    public const string SectionName = "SendGrid";

    /// <summary>
    /// Clé d'API SendGrid. Laissée vide en dev : dans ce cas, <see
    /// cref="LoggingEmailSender"/> est utilisé à la place (voir Program.cs).
    /// </summary>
    public string? ApiKey { get; set; }

    public string FromEmail { get; set; } = "no-reply@petites-annonces.local";

    public string FromName { get; set; } = "Petites annonces";
}

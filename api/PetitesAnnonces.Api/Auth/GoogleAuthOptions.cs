namespace PetitesAnnonces.Api.Auth;

public class GoogleAuthOptions
{
    public const string SectionName = "Google";

    /// <summary>
    /// Client ID OAuth 2.0 créé dans Google Cloud Console (écran de consentement +
    /// identifiants "ID client OAuth", type "Application Web"). À fournir via
    /// la configuration (user-secrets en dev, App Service settings en prod) —
    /// jamais commité.
    /// </summary>
    public string? ClientId { get; set; }
}

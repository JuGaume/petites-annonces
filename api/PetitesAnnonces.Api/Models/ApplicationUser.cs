using Microsoft.AspNetCore.Identity;

namespace PetitesAnnonces.Api.Models;

/// <summary>
/// Utilisateur de la plateforme. Étend l'utilisateur ASP.NET Identity avec les champs
/// propres au produit (nom affiché).
/// </summary>
public class ApplicationUser : IdentityUser
{
    public string DisplayName { get; set; } = string.Empty;
}

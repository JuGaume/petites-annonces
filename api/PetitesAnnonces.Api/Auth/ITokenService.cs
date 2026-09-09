using PetitesAnnonces.Api.Models;

namespace PetitesAnnonces.Api.Auth;

public interface ITokenService
{
    string CreateAccessToken(ApplicationUser user, IList<string> roles);

    /// <summary>Génère un refresh token opaque (valeur en clair à renvoyer au client).</summary>
    string GenerateRefreshTokenValue();

    /// <summary>Empreinte stable d'un refresh token, pour le stocker/comparer sans le garder en clair.</summary>
    string HashRefreshToken(string tokenValue);
}

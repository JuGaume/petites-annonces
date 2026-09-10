using System.Security.Cryptography;

namespace PetitesAnnonces.Api.Auth;

/// <summary>
/// Génère des tokens opaques aléatoires, encodés pour être utilisables tels quels dans
/// un segment d'URL (contrairement au refresh token, base64, qui ne circule jamais
/// dans une URL).
/// </summary>
public static class SecureTokenGenerator
{
    public static string Generate(int byteLength = 24) =>
        Convert.ToHexString(RandomNumberGenerator.GetBytes(byteLength)).ToLowerInvariant();
}

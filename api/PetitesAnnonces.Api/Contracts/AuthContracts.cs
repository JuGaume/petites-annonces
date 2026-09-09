namespace PetitesAnnonces.Api.Contracts;

public record RegisterRequest(string Email, string Password, string DisplayName);

public record LoginRequest(string Email, string Password);

public record GoogleLoginRequest(string IdToken);

public record AuthResponse(string AccessToken, UserResponse User);

public record UserResponse(string Id, string Email, string DisplayName, IReadOnlyList<string> Roles);

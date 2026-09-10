namespace PetitesAnnonces.Api.Contracts;

public record AccountResponse(
    string Id,
    string Email,
    string DisplayName,
    string? PhoneNumber,
    string? PhotoUrl);

public record UpdateAccountRequest(string DisplayName, string? PhoneNumber);

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public record ChangeEmailRequest(string NewEmail, string CurrentPassword);

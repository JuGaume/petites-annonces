using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using PetitesAnnonces.Api.Auth;
using PetitesAnnonces.Api.Contracts;
using PetitesAnnonces.Api.Images;
using PetitesAnnonces.Api.Models;
using PetitesAnnonces.Api.Storage;

namespace PetitesAnnonces.Api.Controllers;

/// <summary>
/// Profil du compte connecté (spec Phase 9) : identifiants (email, mot de passe),
/// coordonnées (téléphone) et photo. Ne couvre que l'utilisateur courant — aucune route
/// ne prend d'identifiant utilisateur en paramètre.
/// </summary>
[ApiController]
[Route("account")]
[Authorize]
public class AccountController(UserManager<ApplicationUser> userManager, IBlobStorageService blobStorage) : ControllerBase
{
    private const int MaxDisplayNameLength = 60;
    private const int MaxPhoneNumberLength = 30;
    private static readonly string[] AllowedPhotoContentTypes = ["image/jpeg", "image/png", "image/webp"];
    private const long MaxPhotoBytes = 5 * 1024 * 1024;

    private string CurrentUserId => User.FindFirst(ClaimTypes.NameIdentifier)!.Value;

    [HttpGet]
    public async Task<ActionResult<AccountResponse>> Get()
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }

        return ToResponse(user);
    }

    [HttpPut]
    public async Task<ActionResult<AccountResponse>> Update(UpdateAccountRequest request)
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }

        var displayName = request.DisplayName?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(displayName))
        {
            return ValidationProblem("Le nom affiché est requis.");
        }

        if (displayName.Length > MaxDisplayNameLength)
        {
            return ValidationProblem($"Le nom affiché ne peut pas dépasser {MaxDisplayNameLength} caractères.");
        }

        var phoneNumber = string.IsNullOrWhiteSpace(request.PhoneNumber) ? null : request.PhoneNumber.Trim();
        if (phoneNumber is { Length: > MaxPhoneNumberLength })
        {
            return ValidationProblem($"Le numéro de téléphone ne peut pas dépasser {MaxPhoneNumberLength} caractères.");
        }

        user.DisplayName = displayName;
        user.PhoneNumber = phoneNumber;
        await userManager.UpdateAsync(user);

        return ToResponse(user);
    }

    [HttpPost("photo")]
    [RequestSizeLimit(MaxPhotoBytes + 1024 * 1024)]
    public async Task<ActionResult<AccountResponse>> UploadPhoto(IFormFile photo)
    {
        if (photo is null || photo.Length == 0)
        {
            return ValidationProblem("Aucune photo reçue.");
        }

        if (!AllowedPhotoContentTypes.Contains(photo.ContentType, StringComparer.OrdinalIgnoreCase))
        {
            return ValidationProblem("Type de fichier non autorisé (jpeg, png ou webp uniquement).");
        }

        if (photo.Length > MaxPhotoBytes)
        {
            return ValidationProblem("La photo doit faire moins de 5 Mo.");
        }

        var user = await userManager.GetUserAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }

        var previousStoragePath = user.PhotoStoragePath;

        await using var stream = photo.OpenReadStream();
        // Miniature carrée (même pipeline que les photos d'annonces) : une photo de profil
        // n'a jamais besoin d'être affichée en grand.
        using var resized = await ThumbnailGenerator.CreateAsync(stream);
        var stored = await blobStorage.SaveAsync(resized, photo.FileName, ThumbnailGenerator.ThumbnailContentType);

        user.PhotoStoragePath = stored.StoragePath;
        user.PhotoUrl = stored.Url;
        await userManager.UpdateAsync(user);

        if (previousStoragePath is not null)
        {
            await blobStorage.DeleteAsync(previousStoragePath);
        }

        return ToResponse(user);
    }

    [HttpDelete("photo")]
    public async Task<IActionResult> DeletePhoto()
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }

        if (user.PhotoStoragePath is not null)
        {
            await blobStorage.DeleteAsync(user.PhotoStoragePath);
            user.PhotoStoragePath = null;
            user.PhotoUrl = null;
            await userManager.UpdateAsync(user);
        }

        return NoContent();
    }

    [HttpPost("change-password")]
    [EnableRateLimiting(RateLimiting.AuthPolicy)]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request)
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }

        var result = await userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
        {
            foreach (var error in result.Errors)
            {
                ModelState.AddModelError(error.Code, error.Description);
            }

            return ValidationProblem(ModelState);
        }

        return NoContent();
    }

    [HttpPost("change-email")]
    [EnableRateLimiting(RateLimiting.AuthPolicy)]
    public async Task<ActionResult<AccountResponse>> ChangeEmail(ChangeEmailRequest request)
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }

        if (!await userManager.CheckPasswordAsync(user, request.CurrentPassword))
        {
            return ValidationProblem("Mot de passe incorrect.");
        }

        var newEmail = request.NewEmail?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(newEmail))
        {
            return ValidationProblem("La nouvelle adresse email est requise.");
        }

        var existing = await userManager.FindByEmailAsync(newEmail);
        if (existing is not null && existing.Id != user.Id)
        {
            return ValidationProblem("Cette adresse email est déjà utilisée.");
        }

        // Le nom d'utilisateur Identity est aligné sur l'email depuis l'inscription
        // (AuthController.Register) : on le garde synchronisé ici aussi.
        var emailResult = await userManager.SetEmailAsync(user, newEmail);
        if (!emailResult.Succeeded)
        {
            foreach (var error in emailResult.Errors)
            {
                ModelState.AddModelError(error.Code, error.Description);
            }

            return ValidationProblem(ModelState);
        }

        await userManager.SetUserNameAsync(user, newEmail);

        return ToResponse(user);
    }

    private static AccountResponse ToResponse(ApplicationUser user) =>
        new(user.Id, user.Email!, user.DisplayName, user.PhoneNumber, user.PhotoUrl);
}

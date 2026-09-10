using System.ComponentModel.DataAnnotations;
using Google.Apis.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PetitesAnnonces.Api.Auth;
using PetitesAnnonces.Api.Contracts;
using PetitesAnnonces.Api.Data;
using PetitesAnnonces.Api.Models;

namespace PetitesAnnonces.Api.Controllers;

[ApiController]
[Route("auth")]
[EnableRateLimiting(RateLimiting.AuthPolicy)]
public class AuthController(
    UserManager<ApplicationUser> userManager,
    ApplicationDbContext db,
    ITokenService tokenService,
    IOptions<JwtOptions> jwtOptions,
    IOptions<GoogleAuthOptions> googleOptions,
    ILogger<AuthController> logger) : ControllerBase
{
    private const string RefreshTokenCookieName = "refreshToken";
    private readonly JwtOptions _jwtOptions = jwtOptions.Value;

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password)
            || string.IsNullOrWhiteSpace(request.DisplayName))
        {
            return ValidationProblem("Email, mot de passe et nom affiché sont requis.");
        }

        if (!new EmailAddressAttribute().IsValid(request.Email))
        {
            return ValidationProblem("Adresse email invalide.");
        }

        var user = new ApplicationUser
        {
            UserName = request.Email,
            Email = request.Email,
            DisplayName = request.DisplayName.Trim(),
        };

        var result = await userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            foreach (var error in result.Errors)
            {
                ModelState.AddModelError(error.Code, error.Description);
            }

            return ValidationProblem(ModelState);
        }

        await userManager.AddToRoleAsync(user, Roles.User);

        return await IssueTokensAsync(user);
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
    {
        var user = await userManager.FindByEmailAsync(request.Email);
        if (user is null || !await userManager.CheckPasswordAsync(user, request.Password))
        {
            return Unauthorized(new { message = "Email ou mot de passe incorrect." });
        }

        if (await userManager.IsLockedOutAsync(user))
        {
            return Unauthorized(new { message = "Ce compte a été désactivé." });
        }

        return await IssueTokensAsync(user);
    }

    [HttpPost("google")]
    public async Task<ActionResult<AuthResponse>> GoogleLogin(GoogleLoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(googleOptions.Value.ClientId))
        {
            return Problem("La connexion Google n'est pas configurée sur ce serveur.", statusCode: 501);
        }

        GoogleJsonWebSignature.Payload payload;
        try
        {
            payload = await GoogleJsonWebSignature.ValidateAsync(request.IdToken, new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = [googleOptions.Value.ClientId],
            });
        }
        catch (InvalidJwtException ex)
        {
            logger.LogWarning(ex, "Jeton Google invalide");
            return Unauthorized(new { message = "Jeton Google invalide." });
        }

        var user = await userManager.FindByEmailAsync(payload.Email);
        if (user is null)
        {
            user = new ApplicationUser
            {
                UserName = payload.Email,
                Email = payload.Email,
                EmailConfirmed = true,
                DisplayName = payload.Name ?? payload.Email,
            };

            var result = await userManager.CreateAsync(user);
            if (!result.Succeeded)
            {
                foreach (var error in result.Errors)
                {
                    ModelState.AddModelError(error.Code, error.Description);
                }

                return ValidationProblem(ModelState);
            }

            await userManager.AddToRoleAsync(user, Roles.User);
        }

        return await IssueTokensAsync(user);
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResponse>> Refresh()
    {
        if (!Request.Cookies.TryGetValue(RefreshTokenCookieName, out var refreshTokenValue)
            || string.IsNullOrEmpty(refreshTokenValue))
        {
            return Unauthorized(new { message = "Aucun refresh token." });
        }

        var tokenHash = tokenService.HashRefreshToken(refreshTokenValue);
        var storedToken = await db.RefreshTokens.FirstOrDefaultAsync(rt => rt.TokenHash == tokenHash);

        if (storedToken is null || !storedToken.IsActive)
        {
            return Unauthorized(new { message = "Refresh token invalide ou expiré." });
        }

        var user = await userManager.FindByIdAsync(storedToken.UserId);
        if (user is null)
        {
            return Unauthorized();
        }

        if (await userManager.IsLockedOutAsync(user))
        {
            return Unauthorized(new { message = "Ce compte a été désactivé." });
        }

        // Rotation : on révoque l'ancien token et on en émet un nouveau.
        storedToken.RevokedAt = DateTimeOffset.UtcNow;

        return await IssueTokensAsync(user);
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        if (Request.Cookies.TryGetValue(RefreshTokenCookieName, out var refreshTokenValue)
            && !string.IsNullOrEmpty(refreshTokenValue))
        {
            var tokenHash = tokenService.HashRefreshToken(refreshTokenValue);
            var storedToken = await db.RefreshTokens.FirstOrDefaultAsync(rt => rt.TokenHash == tokenHash);
            if (storedToken is not null)
            {
                storedToken.RevokedAt = DateTimeOffset.UtcNow;
                await db.SaveChangesAsync();
            }
        }

        Response.Cookies.Delete(RefreshTokenCookieName);
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserResponse>> Me()
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }

        var roles = await userManager.GetRolesAsync(user);
        return new UserResponse(user.Id, user.Email!, user.DisplayName, [.. roles], user.PhotoUrl);
    }

    private async Task<AuthResponse> IssueTokensAsync(ApplicationUser user)
    {
        var roles = await userManager.GetRolesAsync(user);
        var accessToken = tokenService.CreateAccessToken(user, roles);

        var refreshTokenValue = tokenService.GenerateRefreshTokenValue();
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = tokenService.HashRefreshToken(refreshTokenValue),
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(_jwtOptions.RefreshTokenDays),
        });
        await db.SaveChangesAsync();

        Response.Cookies.Append(RefreshTokenCookieName, refreshTokenValue, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Path = "/auth",
            Expires = DateTimeOffset.UtcNow.AddDays(_jwtOptions.RefreshTokenDays),
        });

        return new AuthResponse(accessToken, new UserResponse(user.Id, user.Email!, user.DisplayName, [.. roles], user.PhotoUrl));
    }
}

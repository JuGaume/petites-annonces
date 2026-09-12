using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PetitesAnnonces.Api.Auth;
using PetitesAnnonces.Api.Contracts;
using PetitesAnnonces.Api.Data;
using PetitesAnnonces.Api.Models;

namespace PetitesAnnonces.Api.Controllers;

/// <summary>
/// Recherches enregistrées par un membre dans un groupe — alertées par email via le
/// digest quotidien (voir <c>DigestBuilder.BuildSavedSearchAlertsAsync</c>).
/// </summary>
[ApiController]
[Route("groups/{groupId:int}/saved-searches")]
[Authorize(Policy = GroupPolicies.Member)]
public class SavedSearchesController(ApplicationDbContext db) : ControllerBase
{
    private const int MaxLabelLength = 120;
    // Évite qu'un membre accumule indéfiniment des alertes que le digest devrait
    // évaluer à chaque envoi.
    private const int MaxPerUserPerGroup = 10;

    private string CurrentUserId => User.FindFirst(ClaimTypes.NameIdentifier)!.Value;

    [HttpGet]
    public async Task<ActionResult<List<SavedSearchResponse>>> Mine(int groupId)
    {
        var userId = CurrentUserId;
        return await db.SavedSearches.AsNoTracking()
            .Where(s => s.GroupId == groupId && s.UserId == userId)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new SavedSearchResponse(s.Id, s.Label, s.CategoryId, s.Search, s.MinPrice, s.MaxPrice, s.CreatedAt))
            .ToListAsync();
    }

    [HttpPost]
    public async Task<ActionResult<SavedSearchResponse>> Create(int groupId, CreateSavedSearchRequest request)
    {
        var label = request.Label?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(label))
        {
            return ValidationProblem("Le nom de l'alerte est requis.");
        }

        if (label.Length > MaxLabelLength)
        {
            return ValidationProblem($"Le nom de l'alerte ne peut pas dépasser {MaxLabelLength} caractères.");
        }

        var userId = CurrentUserId;
        var existingCount = await db.SavedSearches.CountAsync(s => s.GroupId == groupId && s.UserId == userId);
        if (existingCount >= MaxPerUserPerGroup)
        {
            return ValidationProblem($"Maximum {MaxPerUserPerGroup} alertes par groupe.");
        }

        var savedSearch = new SavedSearch
        {
            GroupId = groupId,
            UserId = userId,
            Label = label,
            CategoryId = request.CategoryId,
            Search = string.IsNullOrWhiteSpace(request.Search) ? null : request.Search.Trim(),
            MinPrice = request.MinPrice,
            MaxPrice = request.MaxPrice,
        };
        db.SavedSearches.Add(savedSearch);
        await db.SaveChangesAsync();

        return new SavedSearchResponse(
            savedSearch.Id, savedSearch.Label, savedSearch.CategoryId, savedSearch.Search,
            savedSearch.MinPrice, savedSearch.MaxPrice, savedSearch.CreatedAt);
    }

    [HttpDelete("{savedSearchId:int}")]
    public async Task<IActionResult> Delete(int groupId, int savedSearchId)
    {
        var savedSearch = await db.SavedSearches
            .FirstOrDefaultAsync(s => s.Id == savedSearchId && s.GroupId == groupId && s.UserId == CurrentUserId);
        if (savedSearch is null)
        {
            return NotFound();
        }

        db.SavedSearches.Remove(savedSearch);
        await db.SaveChangesAsync();
        return NoContent();
    }
}

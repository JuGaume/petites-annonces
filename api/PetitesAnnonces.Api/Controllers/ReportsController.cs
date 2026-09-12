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
/// Signalement d'une annonce par un membre du groupe — modération communautaire en
/// complément du panneau admin (voir aussi <c>AdminController.ListReports</c>).
/// </summary>
[ApiController]
[Route("groups/{groupId:int}/listings/{listingId:int}/report")]
[Authorize(Policy = GroupPolicies.Member)]
public class ReportsController(ApplicationDbContext db) : ControllerBase
{
    private const int MaxDetailsLength = 500;

    private string CurrentUserId => User.FindFirst(ClaimTypes.NameIdentifier)!.Value;

    [HttpPost]
    public async Task<IActionResult> Create(int groupId, int listingId, CreateReportRequest request)
    {
        var listingExists = await db.Listings.AsNoTracking().AnyAsync(l => l.Id == listingId && l.GroupId == groupId);
        if (!listingExists)
        {
            return NotFound();
        }

        if (!Enum.TryParse<ReportReason>(request.Reason, ignoreCase: true, out var reason))
        {
            return ValidationProblem("Motif de signalement invalide.");
        }

        if (request.Details is { Length: > MaxDetailsLength })
        {
            return ValidationProblem($"Le détail ne peut pas dépasser {MaxDetailsLength} caractères.");
        }

        db.Reports.Add(new Report
        {
            ListingId = listingId,
            ReporterUserId = CurrentUserId,
            Reason = reason,
            Details = string.IsNullOrWhiteSpace(request.Details) ? null : request.Details.Trim(),
        });
        await db.SaveChangesAsync();

        return NoContent();
    }
}

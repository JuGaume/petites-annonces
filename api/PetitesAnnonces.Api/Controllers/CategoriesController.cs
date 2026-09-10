using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using PetitesAnnonces.Api.Caching;
using PetitesAnnonces.Api.Contracts;
using PetitesAnnonces.Api.Data;

namespace PetitesAnnonces.Api.Controllers;

[ApiController]
[Route("categories")]
[Authorize]
public class CategoriesController(ApplicationDbContext db, IMemoryCache cache) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<CategoryResponse>>> List()
    {
        // Liste peu volatile (spec §9) : mise en cache mémoire, invalidée explicitement
        // par AdminController à la création/suppression d'une catégorie.
        var categories = await cache.GetOrCreateAsync(CacheKeys.Categories, async entry =>
        {
            entry.SlidingExpiration = TimeSpan.FromMinutes(10);
            return await db.Categories
                .AsNoTracking()
                .OrderBy(c => c.Name)
                .Select(c => new CategoryResponse(c.Id, c.Name))
                .ToListAsync();
        });

        return categories!;
    }
}

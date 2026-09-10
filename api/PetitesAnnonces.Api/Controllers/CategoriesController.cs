using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PetitesAnnonces.Api.Contracts;
using PetitesAnnonces.Api.Data;

namespace PetitesAnnonces.Api.Controllers;

[ApiController]
[Route("categories")]
[Authorize]
public class CategoriesController(ApplicationDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<CategoryResponse>>> List()
    {
        return await db.Categories
            .AsNoTracking()
            .OrderBy(c => c.Name)
            .Select(c => new CategoryResponse(c.Id, c.Name))
            .ToListAsync();
    }
}

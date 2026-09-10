using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using PetitesAnnonces.Api.Data;
using PetitesAnnonces.Api.Models;

namespace PetitesAnnonces.Api.Auth;

/// <summary>
/// Crée les rôles applicatifs, les catégories fixes d'annonces et, si configuré, un
/// premier compte admin — au démarrage, avant que l'API ne commence à traiter des requêtes.
/// </summary>
public static class DbSeeder
{
    // Liste fixe en v1 (spec §4, hors périmètre : catégories dynamiques) ; gérable plus
    // tard depuis l'interface admin (Phase 6) sans changer ce seed initial.
    private static readonly string[] DefaultCategories =
    [
        "Électronique",
        "Meubles",
        "Vêtements",
        "Sport & Loisirs",
        "Enfants & Bébé",
        "Maison & Jardin",
        "Livres & Médias",
        "Autre",
    ];

    public static async Task SeedAsync(IServiceProvider services)
    {
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
        foreach (var role in Roles.All)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new IdentityRole(role));
            }
        }

        var db = services.GetRequiredService<ApplicationDbContext>();
        if (!await db.Categories.AnyAsync())
        {
            db.Categories.AddRange(DefaultCategories.Select(name => new Category { Name = name }));
            await db.SaveChangesAsync();
        }

        var config = services.GetRequiredService<IConfiguration>();
        var adminEmail = config["Seed:AdminEmail"];
        var adminPassword = config["Seed:AdminPassword"];

        if (string.IsNullOrWhiteSpace(adminEmail) || string.IsNullOrWhiteSpace(adminPassword))
        {
            return;
        }

        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
        var existingAdmin = await userManager.FindByEmailAsync(adminEmail);
        if (existingAdmin is not null)
        {
            return;
        }

        var admin = new ApplicationUser
        {
            UserName = adminEmail,
            Email = adminEmail,
            EmailConfirmed = true,
            DisplayName = "Admin",
        };

        var result = await userManager.CreateAsync(admin, adminPassword);
        if (result.Succeeded)
        {
            await userManager.AddToRolesAsync(admin, [Roles.User, Roles.Admin]);
        }
    }
}

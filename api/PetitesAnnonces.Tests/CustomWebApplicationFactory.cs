using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace PetitesAnnonces.Tests;

/// <summary>
/// Fait pointer l'API vers une base EF Core InMemory dédiée à chaque instance de
/// factory (via la configuration "Database:UseInMemory"), pour des tests rapides et
/// sans dépendance à LocalDB/SQL Server (indisponible en CI Linux).
/// </summary>
public class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly string _databaseName = Guid.NewGuid().ToString();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");

        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Database:UseInMemory"] = "true",
                ["Database:InMemoryName"] = _databaseName,
                // Un run de tests envoie largement plus de requêtes /auth en quelques
                // secondes que ne le permettrait la limite de production.
                ["RateLimiting:Auth:PermitLimit"] = "100000",
            });
        });
    }
}

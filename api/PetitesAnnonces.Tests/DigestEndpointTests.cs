using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using PetitesAnnonces.Api.Contracts;
using Xunit;

namespace PetitesAnnonces.Tests;

/// <summary>Vérifie que le déclenchement manuel du digest (spec Phase 5) reste réservé aux admins.</summary>
public class DigestEndpointTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public DigestEndpointTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Regular_Member_Cannot_Trigger_The_Digest_But_The_Seeded_Admin_Can()
    {
        var client = _factory.CreateClient();
        var registerResponse = await client.PostAsJsonAsync(
            "/auth/register",
            new RegisterRequest($"user-{Guid.NewGuid():N}@example.com", "Str0ngPassw0rd!", "Jamy"));
        var auth = await registerResponse.Content.ReadFromJsonAsync<AuthResponse>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.AccessToken);

        var forbidden = await client.PostAsync("/digest/run-now", content: null);
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);

        // Compte admin seedé au démarrage à partir de Seed:AdminEmail/AdminPassword
        // (appsettings.Development.json — voir DbSeeder).
        var adminClient = _factory.CreateClient();
        var loginResponse = await adminClient.PostAsJsonAsync(
            "/auth/login", new LoginRequest("admin@petites-annonces.local", "ChangeMoi!2026"));
        loginResponse.EnsureSuccessStatusCode();
        var adminAuth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>();
        adminClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", adminAuth!.AccessToken);

        var allowed = await adminClient.PostAsync("/digest/run-now", content: null);
        Assert.Equal(HttpStatusCode.NoContent, allowed.StatusCode);
    }
}

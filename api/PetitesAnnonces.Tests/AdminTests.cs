using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using PetitesAnnonces.Api.Contracts;
using Xunit;

namespace PetitesAnnonces.Tests;

/// <summary>Contrôle d'accès et actions de modération de l'interface admin (Phase 6).</summary>
public class AdminTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public AdminTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private static RegisterRequest NewRegisterRequest(string? email = null) => new(
        Email: email ?? $"user-{Guid.NewGuid():N}@example.com",
        Password: "Str0ngPassw0rd!",
        DisplayName: "Jamy");

    private async Task<(HttpClient Client, UserResponse User)> RegisterAndAuthenticateAsync(string? email = null)
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/auth/register", NewRegisterRequest(email));
        response.EnsureSuccessStatusCode();
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.AccessToken);
        return (client, auth.User);
    }

    /// <summary>Compte admin seedé au démarrage (Seed:AdminEmail/AdminPassword, voir DbSeeder).</summary>
    private async Task<HttpClient> AuthenticateAsAdminAsync()
    {
        var client = _factory.CreateClient();
        var loginResponse = await client.PostAsJsonAsync(
            "/auth/login", new LoginRequest("admin@petites-annonces.local", "ChangeMoi!2026"));
        loginResponse.EnsureSuccessStatusCode();
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.AccessToken);
        return client;
    }

    private static async Task<GroupResponse> CreateGroupAsync(HttpClient client, string name = "Groupe admin")
    {
        var response = await client.PostAsJsonAsync("/groups", new CreateGroupRequest(name, null));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<GroupResponse>())!;
    }

    [Fact]
    public async Task NonAdmin_Cannot_Access_Any_Admin_Endpoint()
    {
        var (client, _) = await RegisterAndAuthenticateAsync();

        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/admin/users")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/admin/groups")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/admin/listings")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/admin/audit-log")).StatusCode);
        Assert.Equal(
            HttpStatusCode.Forbidden,
            (await client.PostAsJsonAsync("/admin/categories", new CreateCategoryRequest("Jouets"))).StatusCode);
    }

    [Fact]
    public async Task Admin_Can_Disable_And_Re_Enable_A_User()
    {
        var (_, user) = await RegisterAndAuthenticateAsync();
        var admin = await AuthenticateAsAdminAsync();

        var listResponse = await admin.GetFromJsonAsync<List<AdminUserResponse>>("/admin/users");
        Assert.Contains(listResponse!, u => u.Id == user.Id && !u.IsDisabled);

        var disableResponse = await admin.PostAsync($"/admin/users/{user.Id}/disable", content: null);
        Assert.Equal(HttpStatusCode.NoContent, disableResponse.StatusCode);

        var loginAfterDisable = await _factory.CreateClient().PostAsJsonAsync(
            "/auth/login", new LoginRequest(user.Email, "Str0ngPassw0rd!"));
        Assert.Equal(HttpStatusCode.Unauthorized, loginAfterDisable.StatusCode);

        var enableResponse = await admin.PostAsync($"/admin/users/{user.Id}/enable", content: null);
        Assert.Equal(HttpStatusCode.NoContent, enableResponse.StatusCode);

        var loginAfterEnable = await _factory.CreateClient().PostAsJsonAsync(
            "/auth/login", new LoginRequest(user.Email, "Str0ngPassw0rd!"));
        Assert.Equal(HttpStatusCode.OK, loginAfterEnable.StatusCode);
    }

    [Fact]
    public async Task Admin_Cannot_Disable_Their_Own_Account()
    {
        var admin = await AuthenticateAsAdminAsync();
        var me = await admin.GetFromJsonAsync<UserResponse>("/auth/me");

        var response = await admin.PostAsync($"/admin/users/{me!.Id}/disable", content: null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Admin_Can_List_And_Delete_A_Group()
    {
        var (owner, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);
        var admin = await AuthenticateAsAdminAsync();

        var groups = await admin.GetFromJsonAsync<List<AdminGroupResponse>>("/admin/groups");
        Assert.Contains(groups!, g => g.Id == group.Id);

        var deleteResponse = await admin.DeleteAsync($"/admin/groups/{group.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        // Sur SQL Server, la suppression cascade aussi les adhésions (contrainte FK) : la
        // policy GroupMember échoue avant même d'atteindre l'action → 403. Le fournisseur
        // InMemory des tests ne cascade que les entités déjà chargées dans le contexte,
        // donc la ligne d'adhésion peut subsister — l'action est alors atteinte mais ne
        // trouve plus le groupe → 404. Les deux traduisent correctement l'inaccessibilité.
        var getAfterDelete = await owner.GetAsync($"/groups/{group.Id}");
        Assert.True(
            getAfterDelete.StatusCode is HttpStatusCode.Forbidden or HttpStatusCode.NotFound,
            $"Attendu Forbidden ou NotFound, obtenu {getAfterDelete.StatusCode}.");
    }

    [Fact]
    public async Task Admin_Can_List_And_Delete_A_Listing()
    {
        var (owner, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);
        var categoryId = (await owner.GetFromJsonAsync<List<CategoryResponse>>("/categories"))!.First().Id;

        var form = new MultipartFormDataContent
        {
            { new StringContent("Vélo"), "Title" },
            { new StringContent("Donation"), "Mode" },
            { new StringContent(categoryId.ToString()), "CategoryId" },
            { new StringContent("DirectContact"), "ContactMode" },
            { new StringContent("0600000000"), "ContactDetails" },
        };
        var createResponse = await owner.PostAsync($"/groups/{group.Id}/listings", form);
        var listing = await createResponse.Content.ReadFromJsonAsync<ListingDetailResponse>();

        var admin = await AuthenticateAsAdminAsync();
        var listings = await admin.GetFromJsonAsync<List<AdminListingResponse>>($"/admin/listings?groupId={group.Id}");
        Assert.Contains(listings!, l => l.Id == listing!.Id);

        var deleteResponse = await admin.DeleteAsync($"/admin/listings/{listing!.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var getAfterDelete = await owner.GetAsync($"/groups/{group.Id}/listings/{listing.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getAfterDelete.StatusCode);
    }

    [Fact]
    public async Task Admin_Can_Create_A_Category_But_Cannot_Delete_One_In_Use()
    {
        var admin = await AuthenticateAsAdminAsync();

        var createResponse = await admin.PostAsJsonAsync("/admin/categories", new CreateCategoryRequest($"Cat-{Guid.NewGuid():N}"));
        Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);
        var category = await createResponse.Content.ReadFromJsonAsync<CategoryResponse>();

        var duplicateResponse = await admin.PostAsJsonAsync("/admin/categories", new CreateCategoryRequest(category!.Name));
        Assert.Equal(HttpStatusCode.BadRequest, duplicateResponse.StatusCode);

        var (owner, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);
        var form = new MultipartFormDataContent
        {
            { new StringContent("Objet"), "Title" },
            { new StringContent("Donation"), "Mode" },
            { new StringContent(category.Id.ToString()), "CategoryId" },
            { new StringContent("DirectContact"), "ContactMode" },
            { new StringContent("0600000000"), "ContactDetails" },
        };
        await owner.PostAsync($"/groups/{group.Id}/listings", form);

        var deleteInUse = await admin.DeleteAsync($"/admin/categories/{category.Id}");
        Assert.Equal(HttpStatusCode.BadRequest, deleteInUse.StatusCode);
    }

    [Fact]
    public async Task Admin_Actions_Are_Recorded_In_The_Audit_Log()
    {
        var admin = await AuthenticateAsAdminAsync();
        var categoryName = $"Cat-{Guid.NewGuid():N}";

        await admin.PostAsJsonAsync("/admin/categories", new CreateCategoryRequest(categoryName));

        var auditLog = await admin.GetFromJsonAsync<List<AuditLogEntryResponse>>("/admin/audit-log");

        Assert.Contains(auditLog!, e => e.Action == "CreateCategory" && e.Details == categoryName);
    }
}

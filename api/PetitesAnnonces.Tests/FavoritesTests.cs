using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using PetitesAnnonces.Api.Contracts;
using Xunit;

namespace PetitesAnnonces.Tests;

public class FavoritesTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public FavoritesTests(CustomWebApplicationFactory factory)
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

    private static async Task<GroupResponse> CreateGroupAsync(HttpClient client, string name = "Groupe favoris") =>
        (await (await client.PostAsJsonAsync("/groups", new CreateGroupRequest(name, null)))
            .Content.ReadFromJsonAsync<GroupResponse>())!;

    private static async Task<int> CreateListingAsync(HttpClient client, int groupId)
    {
        var categoryId = (await client.GetFromJsonAsync<List<CategoryResponse>>("/categories"))!.First().Id;
        var form = new MultipartFormDataContent
        {
            { new StringContent("Vélo enfant"), "Title" },
            { new StringContent("Sale"), "Mode" },
            { new StringContent(categoryId.ToString()), "CategoryId" },
            { new StringContent("DirectContact"), "ContactMode" },
            { new StringContent("20"), "Price" },
            { new StringContent("06 00 00 00 00"), "ContactDetails" },
        };

        var response = await client.PostAsync($"/groups/{groupId}/listings", form);
        response.EnsureSuccessStatusCode();
        var listing = await response.Content.ReadFromJsonAsync<ListingDetailResponse>();
        return listing!.Id;
    }

    [Fact]
    public async Task Member_Can_Favorite_And_Unfavorite_A_Listing()
    {
        var (owner, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);
        var listingId = await CreateListingAsync(owner, group.Id);

        var addResponse = await owner.PutAsync($"/groups/{group.Id}/listings/{listingId}/favorite", content: null);
        Assert.Equal(HttpStatusCode.NoContent, addResponse.StatusCode);

        var detail = await owner.GetFromJsonAsync<ListingDetailResponse>($"/groups/{group.Id}/listings/{listingId}");
        Assert.True(detail!.IsFavorite);

        var removeResponse = await owner.DeleteAsync($"/groups/{group.Id}/listings/{listingId}/favorite");
        Assert.Equal(HttpStatusCode.NoContent, removeResponse.StatusCode);

        var detailAfter = await owner.GetFromJsonAsync<ListingDetailResponse>($"/groups/{group.Id}/listings/{listingId}");
        Assert.False(detailAfter!.IsFavorite);
    }

    [Fact]
    public async Task Favoriting_Twice_Is_Idempotent()
    {
        var (owner, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);
        var listingId = await CreateListingAsync(owner, group.Id);

        var first = await owner.PutAsync($"/groups/{group.Id}/listings/{listingId}/favorite", content: null);
        var second = await owner.PutAsync($"/groups/{group.Id}/listings/{listingId}/favorite", content: null);

        Assert.Equal(HttpStatusCode.NoContent, first.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, second.StatusCode);

        var favorites = await owner.GetFromJsonAsync<List<FavoriteListingResponse>>("/favorites");
        Assert.Single(favorites!);
    }

    [Fact]
    public async Task Mine_Lists_Favorites_With_Group_Context()
    {
        var (owner, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner, "Groupe X");
        var listingId = await CreateListingAsync(owner, group.Id);

        await owner.PutAsync($"/groups/{group.Id}/listings/{listingId}/favorite", content: null);

        var favorites = await owner.GetFromJsonAsync<List<FavoriteListingResponse>>("/favorites");
        var favorite = Assert.Single(favorites!);
        Assert.Equal(listingId, favorite.ListingId);
        Assert.Equal(group.Id, favorite.GroupId);
        Assert.Equal("Groupe X", favorite.GroupName);
    }

    [Fact]
    public async Task NonMember_Cannot_Favorite_A_Listing()
    {
        var (owner, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);
        var listingId = await CreateListingAsync(owner, group.Id);

        var (outsider, _) = await RegisterAndAuthenticateAsync();
        var response = await outsider.PutAsync($"/groups/{group.Id}/listings/{listingId}/favorite", content: null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Deleting_A_Listing_Also_Removes_It_From_Favorites()
    {
        var (owner, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);
        var listingId = await CreateListingAsync(owner, group.Id);
        await owner.PutAsync($"/groups/{group.Id}/listings/{listingId}/favorite", content: null);

        var deleteResponse = await owner.DeleteAsync($"/groups/{group.Id}/listings/{listingId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var favorites = await owner.GetFromJsonAsync<List<FavoriteListingResponse>>("/favorites");
        Assert.Empty(favorites!);
    }
}

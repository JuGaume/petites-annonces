using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using PetitesAnnonces.Api.Contracts;
using PetitesAnnonces.Api.Models;
using Xunit;

namespace PetitesAnnonces.Tests;

public class ListingsTests : IClassFixture<CustomWebApplicationFactory>
{
    // 1x1 PNG transparent minimal, suffisant pour exercer le pipeline de miniature
    // (SixLabors.ImageSharp) sans dépendre d'un fichier externe.
    private static readonly byte[] TinyPng = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");

    private readonly CustomWebApplicationFactory _factory;

    public ListingsTests(CustomWebApplicationFactory factory)
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

    private static async Task<GroupResponse> CreateGroupAsync(HttpClient client, string name = "Groupe annonces")
    {
        var response = await client.PostAsJsonAsync("/groups", new CreateGroupRequest(name, null));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<GroupResponse>())!;
    }

    /// <summary>Fait rejoindre <paramref name="joiner"/> au groupe via une invitation-lien générée par <paramref name="owner"/>.</summary>
    private static async Task JoinGroupAsync(HttpClient owner, HttpClient joiner, int groupId)
    {
        var linkResponse = await owner.PostAsync($"/groups/{groupId}/invitations/link", content: null);
        var link = (await linkResponse.Content.ReadFromJsonAsync<InvitationResponse>())!;
        var acceptResponse = await joiner.PostAsync($"/invitations/{link.Token}/accept", content: null);
        acceptResponse.EnsureSuccessStatusCode();
    }

    private static async Task<int> GetFirstCategoryIdAsync(HttpClient client)
    {
        var categories = await client.GetFromJsonAsync<List<CategoryResponse>>("/categories");
        return categories!.First().Id;
    }

    private static MultipartFormDataContent BuildListingForm(
        int categoryId,
        string title = "Vélo enfant",
        string? description = "Bon état, peu servi",
        decimal? price = 20,
        string mode = "Sale",
        string contactMode = "DirectContact",
        string? contactDetails = "06 00 00 00 00",
        IReadOnlyList<byte[]>? images = null)
    {
        var form = new MultipartFormDataContent
        {
            { new StringContent(title), "Title" },
            { new StringContent(mode), "Mode" },
            { new StringContent(categoryId.ToString(CultureInfo.InvariantCulture)), "CategoryId" },
            { new StringContent(contactMode), "ContactMode" },
        };

        if (description is not null)
        {
            form.Add(new StringContent(description), "Description");
        }

        if (price is not null)
        {
            form.Add(new StringContent(price.Value.ToString(CultureInfo.InvariantCulture)), "Price");
        }

        if (contactDetails is not null)
        {
            form.Add(new StringContent(contactDetails), "ContactDetails");
        }

        foreach (var image in images ?? [])
        {
            var fileContent = new ByteArrayContent(image);
            fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
            form.Add(fileContent, "Images", "photo.png");
        }

        return form;
    }

    [Fact]
    public async Task Create_Listing_Without_Images_Succeeds()
    {
        var (client, user) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(client);
        var categoryId = await GetFirstCategoryIdAsync(client);

        var response = await client.PostAsync(
            $"/groups/{group.Id}/listings",
            BuildListingForm(categoryId));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var listing = await response.Content.ReadFromJsonAsync<ListingDetailResponse>();

        Assert.Equal("Vélo enfant", listing!.Title);
        Assert.Equal(20, listing.Price);
        Assert.Equal("Sale", listing.Mode);
        Assert.Equal("Available", listing.Status);
        Assert.Equal(user.Id, listing.AuthorUserId);
        Assert.Empty(listing.Images);
    }

    [Fact]
    public async Task Create_Listing_With_Image_Generates_A_Thumbnail()
    {
        var (client, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(client);
        var categoryId = await GetFirstCategoryIdAsync(client);

        var response = await client.PostAsync(
            $"/groups/{group.Id}/listings",
            BuildListingForm(categoryId, images: [TinyPng]));

        response.EnsureSuccessStatusCode();
        var listing = await response.Content.ReadFromJsonAsync<ListingDetailResponse>();

        var image = Assert.Single(listing!.Images);
        Assert.False(string.IsNullOrWhiteSpace(image.Url));
        Assert.False(string.IsNullOrWhiteSpace(image.ThumbnailUrl));
        Assert.NotEqual(image.Url, image.ThumbnailUrl);
    }

    [Fact]
    public async Task Create_Listing_Requires_A_Price_For_Sale_Mode()
    {
        var (client, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(client);
        var categoryId = await GetFirstCategoryIdAsync(client);

        var response = await client.PostAsync(
            $"/groups/{group.Id}/listings",
            BuildListingForm(categoryId, mode: "Sale", price: null));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_Listing_Rejects_A_Price_For_Donation_Mode()
    {
        var (client, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(client);
        var categoryId = await GetFirstCategoryIdAsync(client);

        var response = await client.PostAsync(
            $"/groups/{group.Id}/listings",
            BuildListingForm(categoryId, mode: "Donation", price: 5));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_Listing_Requires_Contact_Details_For_Direct_Contact()
    {
        var (client, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(client);
        var categoryId = await GetFirstCategoryIdAsync(client);

        var response = await client.PostAsync(
            $"/groups/{group.Id}/listings",
            BuildListingForm(categoryId, contactMode: "DirectContact", contactDetails: null));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_Listing_Rejects_Unknown_Category()
    {
        var (client, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(client);

        var response = await client.PostAsync(
            $"/groups/{group.Id}/listings",
            BuildListingForm(categoryId: 999_999));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task NonMember_Cannot_List_Or_Create_Listings()
    {
        var (owner, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);
        var categoryId = await GetFirstCategoryIdAsync(owner);

        var (outsider, _) = await RegisterAndAuthenticateAsync();

        var listResponse = await outsider.GetAsync($"/groups/{group.Id}/listings");
        var createResponse = await outsider.PostAsync($"/groups/{group.Id}/listings", BuildListingForm(categoryId));

        Assert.Equal(HttpStatusCode.Forbidden, listResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, createResponse.StatusCode);
    }

    [Fact]
    public async Task List_Filters_By_Category_And_Status()
    {
        var (client, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(client);
        var categories = await client.GetFromJsonAsync<List<CategoryResponse>>("/categories");
        var (categoryA, categoryB) = (categories![0].Id, categories![1].Id);

        var listingA = (await (await client.PostAsync($"/groups/{group.Id}/listings", BuildListingForm(categoryA)))
            .Content.ReadFromJsonAsync<ListingDetailResponse>())!;
        await client.PostAsync($"/groups/{group.Id}/listings", BuildListingForm(categoryB));

        await client.PatchAsJsonAsync($"/groups/{group.Id}/listings/{listingA.Id}/status", new UpdateListingStatusRequest(ListingStatus.Sold));

        var byCategoryResponse = await client.GetFromJsonAsync<PagedResult<ListingSummaryResponse>>(
            $"/groups/{group.Id}/listings?categoryId={categoryA}");
        var byStatusResponse = await client.GetFromJsonAsync<PagedResult<ListingSummaryResponse>>(
            $"/groups/{group.Id}/listings?status=Sold");

        Assert.Single(byCategoryResponse!.Items);
        Assert.Single(byStatusResponse!.Items);
        Assert.Equal(listingA.Id, byStatusResponse.Items[0].Id);
    }

    [Fact]
    public async Task Author_Can_Update_Listing_Status_But_Other_Members_Cannot()
    {
        var (owner, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);
        var categoryId = await GetFirstCategoryIdAsync(owner);

        var listing = (await (await owner.PostAsync($"/groups/{group.Id}/listings", BuildListingForm(categoryId)))
            .Content.ReadFromJsonAsync<ListingDetailResponse>())!;

        var (otherMember, _) = await RegisterAndAuthenticateAsync();
        await JoinGroupAsync(owner, otherMember, group.Id);

        var forbiddenUpdate = await otherMember.PatchAsJsonAsync(
            $"/groups/{group.Id}/listings/{listing.Id}/status", new UpdateListingStatusRequest(ListingStatus.Reserved));
        Assert.Equal(HttpStatusCode.Forbidden, forbiddenUpdate.StatusCode);

        var allowedUpdate = await owner.PatchAsJsonAsync(
            $"/groups/{group.Id}/listings/{listing.Id}/status", new UpdateListingStatusRequest(ListingStatus.Reserved));
        Assert.Equal(HttpStatusCode.OK, allowedUpdate.StatusCode);
        var updated = await allowedUpdate.Content.ReadFromJsonAsync<ListingDetailResponse>();
        Assert.Equal("Reserved", updated!.Status);
    }

    [Fact]
    public async Task Author_Can_Delete_Listing_But_Other_Members_Cannot()
    {
        var (owner, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);
        var categoryId = await GetFirstCategoryIdAsync(owner);

        var listing = (await (await owner.PostAsync($"/groups/{group.Id}/listings", BuildListingForm(categoryId)))
            .Content.ReadFromJsonAsync<ListingDetailResponse>())!;

        var (otherMember, _) = await RegisterAndAuthenticateAsync();
        await JoinGroupAsync(owner, otherMember, group.Id);

        var forbiddenDelete = await otherMember.DeleteAsync($"/groups/{group.Id}/listings/{listing.Id}");
        Assert.Equal(HttpStatusCode.Forbidden, forbiddenDelete.StatusCode);

        var allowedDelete = await owner.DeleteAsync($"/groups/{group.Id}/listings/{listing.Id}");
        Assert.Equal(HttpStatusCode.NoContent, allowedDelete.StatusCode);

        var getAfterDelete = await owner.GetAsync($"/groups/{group.Id}/listings/{listing.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getAfterDelete.StatusCode);
    }

    [Fact]
    public async Task Listings_Are_Isolated_Between_Groups()
    {
        var (ownerA, _) = await RegisterAndAuthenticateAsync();
        var (ownerB, _) = await RegisterAndAuthenticateAsync();

        var groupA = await CreateGroupAsync(ownerA, "Groupe A");
        var groupB = await CreateGroupAsync(ownerB, "Groupe B");
        var categoryId = await GetFirstCategoryIdAsync(ownerA);

        await ownerB.PostAsync($"/groups/{groupB.Id}/listings", BuildListingForm(categoryId));

        var (memberA, _) = await RegisterAndAuthenticateAsync();
        await JoinGroupAsync(ownerA, memberA, groupA.Id);

        // Un membre du groupe A ne voit ni le flux, ni le détail d'une annonce du groupe B.
        var listResponse = await memberA.GetAsync($"/groups/{groupB.Id}/listings");
        Assert.Equal(HttpStatusCode.Forbidden, listResponse.StatusCode);
    }
}

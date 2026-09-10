using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using PetitesAnnonces.Api.Contracts;
using Xunit;

namespace PetitesAnnonces.Tests;

public class ConversationsTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public ConversationsTests(CustomWebApplicationFactory factory)
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

    private static async Task<GroupResponse> CreateGroupAsync(HttpClient client, string name = "Groupe messagerie")
    {
        var response = await client.PostAsJsonAsync("/groups", new CreateGroupRequest(name, null));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<GroupResponse>())!;
    }

    private static async Task JoinGroupAsync(HttpClient owner, HttpClient joiner, int groupId)
    {
        var linkResponse = await owner.PostAsync($"/groups/{groupId}/invitations/link", content: null);
        var link = (await linkResponse.Content.ReadFromJsonAsync<InvitationResponse>())!;
        var acceptResponse = await joiner.PostAsync($"/invitations/{link.Token}/accept", content: null);
        acceptResponse.EnsureSuccessStatusCode();
    }

    /// <summary>Crée une annonce en mode messagerie interne (le seul mode pertinent pour ces tests).</summary>
    private static async Task<ListingDetailResponse> CreateInternalMessagingListingAsync(HttpClient seller, int groupId)
    {
        var categoryId = (await seller.GetFromJsonAsync<List<CategoryResponse>>("/categories"))!.First().Id;

        var form = new MultipartFormDataContent
        {
            { new StringContent("Vélo enfant"), "Title" },
            { new StringContent("Donation"), "Mode" },
            { new StringContent(categoryId.ToString()), "CategoryId" },
            { new StringContent("InternalMessaging"), "ContactMode" },
        };

        var response = await seller.PostAsync($"/groups/{groupId}/listings", form);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<ListingDetailResponse>())!;
    }

    [Fact]
    public async Task Buyer_Can_Start_A_Conversation_With_The_Seller()
    {
        var (seller, sellerUser) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(seller);
        var listing = await CreateInternalMessagingListingAsync(seller, group.Id);

        var (buyer, buyerUser) = await RegisterAndAuthenticateAsync();
        await JoinGroupAsync(seller, buyer, group.Id);

        var response = await buyer.PostAsync($"/groups/{group.Id}/listings/{listing.Id}/conversations", content: null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var conversation = await response.Content.ReadFromJsonAsync<ConversationResponse>();
        Assert.Equal(buyerUser.Id, conversation!.BuyerUserId);
        Assert.Equal(sellerUser.Id, conversation.SellerUserId);
        Assert.Equal(listing.Title, conversation.ListingTitle);
    }

    [Fact]
    public async Task Author_Cannot_Start_A_Conversation_With_Their_Own_Listing()
    {
        var (seller, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(seller);
        var listing = await CreateInternalMessagingListingAsync(seller, group.Id);

        var response = await seller.PostAsync($"/groups/{group.Id}/listings/{listing.Id}/conversations", content: null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Starting_A_Conversation_Twice_Returns_The_Same_One()
    {
        var (seller, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(seller);
        var listing = await CreateInternalMessagingListingAsync(seller, group.Id);

        var (buyer, _) = await RegisterAndAuthenticateAsync();
        await JoinGroupAsync(seller, buyer, group.Id);

        var first = await (await buyer.PostAsync($"/groups/{group.Id}/listings/{listing.Id}/conversations", content: null))
            .Content.ReadFromJsonAsync<ConversationResponse>();
        var second = await (await buyer.PostAsync($"/groups/{group.Id}/listings/{listing.Id}/conversations", content: null))
            .Content.ReadFromJsonAsync<ConversationResponse>();

        Assert.Equal(first!.Id, second!.Id);
    }

    [Fact]
    public async Task NonMember_Cannot_Start_A_Conversation()
    {
        var (seller, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(seller);
        var listing = await CreateInternalMessagingListingAsync(seller, group.Id);

        var (outsider, _) = await RegisterAndAuthenticateAsync();

        var response = await outsider.PostAsync($"/groups/{group.Id}/listings/{listing.Id}/conversations", content: null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Messages_Are_Persisted_And_Returned_In_Chronological_Order()
    {
        var (seller, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(seller);
        var listing = await CreateInternalMessagingListingAsync(seller, group.Id);

        var (buyer, _) = await RegisterAndAuthenticateAsync();
        await JoinGroupAsync(seller, buyer, group.Id);

        var conversation = await (await buyer.PostAsync($"/groups/{group.Id}/listings/{listing.Id}/conversations", content: null))
            .Content.ReadFromJsonAsync<ConversationResponse>();

        await buyer.PostAsJsonAsync($"/conversations/{conversation!.Id}/messages", new SendMessageRequest("Bonjour, toujours dispo ?"));
        await seller.PostAsJsonAsync($"/conversations/{conversation.Id}/messages", new SendMessageRequest("Oui !"));

        var messages = await seller.GetFromJsonAsync<List<MessageResponse>>($"/conversations/{conversation.Id}/messages");

        Assert.Equal(2, messages!.Count);
        Assert.Equal("Bonjour, toujours dispo ?", messages[0].Content);
        Assert.Equal("Oui !", messages[1].Content);
    }

    [Fact]
    public async Task NonParticipant_Cannot_Read_Or_Send_Messages()
    {
        var (seller, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(seller);
        var listing = await CreateInternalMessagingListingAsync(seller, group.Id);

        var (buyer, _) = await RegisterAndAuthenticateAsync();
        await JoinGroupAsync(seller, buyer, group.Id);
        var conversation = await (await buyer.PostAsync($"/groups/{group.Id}/listings/{listing.Id}/conversations", content: null))
            .Content.ReadFromJsonAsync<ConversationResponse>();

        var (otherMember, _) = await RegisterAndAuthenticateAsync();
        await JoinGroupAsync(seller, otherMember, group.Id);

        var readResponse = await otherMember.GetAsync($"/conversations/{conversation!.Id}/messages");
        var sendResponse = await otherMember.PostAsJsonAsync($"/conversations/{conversation.Id}/messages", new SendMessageRequest("Je m'incruste"));

        Assert.Equal(HttpStatusCode.Forbidden, readResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, sendResponse.StatusCode);
    }

    [Fact]
    public async Task Sending_An_Empty_Message_Fails()
    {
        var (seller, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(seller);
        var listing = await CreateInternalMessagingListingAsync(seller, group.Id);

        var (buyer, _) = await RegisterAndAuthenticateAsync();
        await JoinGroupAsync(seller, buyer, group.Id);
        var conversation = await (await buyer.PostAsync($"/groups/{group.Id}/listings/{listing.Id}/conversations", content: null))
            .Content.ReadFromJsonAsync<ConversationResponse>();

        var response = await buyer.PostAsJsonAsync($"/conversations/{conversation!.Id}/messages", new SendMessageRequest("   "));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Mine_Lists_Conversations_For_Both_Buyer_And_Seller()
    {
        var (seller, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(seller);
        var listing = await CreateInternalMessagingListingAsync(seller, group.Id);

        var (buyer, _) = await RegisterAndAuthenticateAsync();
        await JoinGroupAsync(seller, buyer, group.Id);
        var conversation = await (await buyer.PostAsync($"/groups/{group.Id}/listings/{listing.Id}/conversations", content: null))
            .Content.ReadFromJsonAsync<ConversationResponse>();
        await buyer.PostAsJsonAsync($"/conversations/{conversation!.Id}/messages", new SendMessageRequest("Salut"));

        var sellerConversations = await seller.GetFromJsonAsync<List<ConversationResponse>>("/conversations");
        var buyerConversations = await buyer.GetFromJsonAsync<List<ConversationResponse>>("/conversations");

        var sellerView = Assert.Single(sellerConversations!);
        var buyerView = Assert.Single(buyerConversations!);
        Assert.Equal(conversation.Id, sellerView.Id);
        Assert.Equal(conversation.Id, buyerView.Id);
        Assert.Equal("Salut", sellerView.LastMessageContent);
    }
}

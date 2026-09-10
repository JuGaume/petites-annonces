using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using PetitesAnnonces.Api.Contracts;
using Xunit;

namespace PetitesAnnonces.Tests;

public class GroupsTests : IClassFixture<CustomWebApplicationFactory>
{
    // 1x1 PNG transparent minimal (même image de test que ListingsTests).
    private static readonly byte[] TinyPng = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");

    private readonly CustomWebApplicationFactory _factory;

    public GroupsTests(CustomWebApplicationFactory factory)
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
        var request = NewRegisterRequest(email);

        var response = await client.PostAsJsonAsync("/auth/register", request);
        response.EnsureSuccessStatusCode();
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.AccessToken);
        return (client, auth.User);
    }

    private static async Task<GroupResponse> CreateGroupAsync(HttpClient client, string name = "Amis de la fac")
    {
        var response = await client.PostAsJsonAsync("/groups", new CreateGroupRequest(name, "Objets à échanger entre nous"));
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

    [Fact]
    public async Task Create_Group_Makes_Creator_An_Admin_Member()
    {
        var (client, user) = await RegisterAndAuthenticateAsync();

        var group = await CreateGroupAsync(client);

        Assert.Equal("Amis de la fac", group.Name);
        Assert.Equal(user.Id, group.CreatedByUserId);
        Assert.Equal(1, group.MemberCount);
        Assert.Equal("Admin", group.CurrentUserRole);
    }

    [Fact]
    public async Task Mine_Lists_Only_Groups_The_User_Belongs_To()
    {
        var (client, _) = await RegisterAndAuthenticateAsync();
        var (otherClient, _) = await RegisterAndAuthenticateAsync();

        await CreateGroupAsync(client, "Groupe A");
        await CreateGroupAsync(otherClient, "Groupe B");

        var response = await client.GetAsync("/groups");
        response.EnsureSuccessStatusCode();
        var groups = await response.Content.ReadFromJsonAsync<List<GroupResponse>>();

        var group = Assert.Single(groups!);
        Assert.Equal("Groupe A", group.Name);
    }

    [Fact]
    public async Task NonMember_Cannot_Access_Group_Details_Or_Members()
    {
        var (owner, _) = await RegisterAndAuthenticateAsync();
        var (outsider, _) = await RegisterAndAuthenticateAsync();

        var group = await CreateGroupAsync(owner);

        var getResponse = await outsider.GetAsync($"/groups/{group.Id}");
        var membersResponse = await outsider.GetAsync($"/groups/{group.Id}/members");

        Assert.Equal(HttpStatusCode.Forbidden, getResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, membersResponse.StatusCode);
    }

    [Fact]
    public async Task Members_Endpoint_Lists_All_Members_Of_The_Group()
    {
        var (owner, ownerUser) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);

        var linkResponse = await owner.PostAsync($"/groups/{group.Id}/invitations/link", content: null);
        linkResponse.EnsureSuccessStatusCode();
        var link = (await linkResponse.Content.ReadFromJsonAsync<InvitationResponse>())!;

        var (joiner, joinerUser) = await RegisterAndAuthenticateAsync();
        var acceptResponse = await joiner.PostAsync($"/invitations/{link.Token}/accept", content: null);
        acceptResponse.EnsureSuccessStatusCode();

        var membersResponse = await owner.GetAsync($"/groups/{group.Id}/members");
        membersResponse.EnsureSuccessStatusCode();
        var members = await membersResponse.Content.ReadFromJsonAsync<List<GroupMemberResponse>>();

        Assert.Equal(2, members!.Count);
        Assert.Contains(members, m => m.UserId == ownerUser.Id && m.Role == "Admin");
        Assert.Contains(members, m => m.UserId == joinerUser.Id && m.Role == "Member");
    }

    [Fact]
    public async Task NonAdmin_Member_Cannot_Generate_An_Invitation()
    {
        var (owner, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);

        var linkResponse = await owner.PostAsync($"/groups/{group.Id}/invitations/link", content: null);
        var link = (await linkResponse.Content.ReadFromJsonAsync<InvitationResponse>())!;

        var (member, _) = await RegisterAndAuthenticateAsync();
        await member.PostAsync($"/invitations/{link.Token}/accept", content: null);

        var forbiddenResponse = await member.PostAsync($"/groups/{group.Id}/invitations/link", content: null);

        Assert.Equal(HttpStatusCode.Forbidden, forbiddenResponse.StatusCode);
    }

    [Fact]
    public async Task Link_Invitation_Is_Reusable_By_Several_People()
    {
        var (owner, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);

        var linkResponse = await owner.PostAsync($"/groups/{group.Id}/invitations/link", content: null);
        var link = (await linkResponse.Content.ReadFromJsonAsync<InvitationResponse>())!;

        var (firstJoiner, _) = await RegisterAndAuthenticateAsync();
        var (secondJoiner, _) = await RegisterAndAuthenticateAsync();

        var firstAccept = await firstJoiner.PostAsync($"/invitations/{link.Token}/accept", content: null);
        var secondAccept = await secondJoiner.PostAsync($"/invitations/{link.Token}/accept", content: null);

        Assert.Equal(HttpStatusCode.OK, firstAccept.StatusCode);
        Assert.Equal(HttpStatusCode.OK, secondAccept.StatusCode);
    }

    [Fact]
    public async Task Requesting_A_Link_Invitation_Twice_Returns_The_Same_Active_Token()
    {
        var (owner, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);

        var first = await (await owner.PostAsync($"/groups/{group.Id}/invitations/link", content: null))
            .Content.ReadFromJsonAsync<InvitationResponse>();
        var second = await (await owner.PostAsync($"/groups/{group.Id}/invitations/link", content: null))
            .Content.ReadFromJsonAsync<InvitationResponse>();

        Assert.Equal(first!.Token, second!.Token);
    }

    [Fact]
    public async Task Revoked_Link_Invitation_Can_No_Longer_Be_Accepted()
    {
        var (owner, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);

        var link = (await (await owner.PostAsync($"/groups/{group.Id}/invitations/link", content: null))
            .Content.ReadFromJsonAsync<InvitationResponse>())!;

        var revokeResponse = await owner.PostAsync($"/groups/{group.Id}/invitations/link/revoke", content: null);
        Assert.Equal(HttpStatusCode.NoContent, revokeResponse.StatusCode);

        var (joiner, _) = await RegisterAndAuthenticateAsync();
        var acceptResponse = await joiner.PostAsync($"/invitations/{link.Token}/accept", content: null);

        Assert.Equal(HttpStatusCode.BadRequest, acceptResponse.StatusCode);
    }

    [Fact]
    public async Task Email_Invitation_Can_Only_Be_Accepted_By_Its_Target()
    {
        var (owner, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);

        var targetEmail = $"invitee-{Guid.NewGuid():N}@example.com";
        var inviteResponse = await owner.PostAsJsonAsync(
            $"/groups/{group.Id}/invitations/email",
            new CreateEmailInvitationRequest(targetEmail));
        inviteResponse.EnsureSuccessStatusCode();
        var invitation = (await inviteResponse.Content.ReadFromJsonAsync<InvitationResponse>())!;

        var (wrongPerson, _) = await RegisterAndAuthenticateAsync();
        var wrongAttempt = await wrongPerson.PostAsync($"/invitations/{invitation.Token}/accept", content: null);
        Assert.Equal(HttpStatusCode.Forbidden, wrongAttempt.StatusCode);

        var (targetPerson, _) = await RegisterAndAuthenticateAsync(targetEmail);
        var correctAttempt = await targetPerson.PostAsync($"/invitations/{invitation.Token}/accept", content: null);
        Assert.Equal(HttpStatusCode.OK, correctAttempt.StatusCode);
    }

    [Fact]
    public async Task Email_Invitation_Is_Single_Use()
    {
        var (owner, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);

        var targetEmail = $"invitee-{Guid.NewGuid():N}@example.com";
        var invitation = (await (await owner.PostAsJsonAsync(
            $"/groups/{group.Id}/invitations/email",
            new CreateEmailInvitationRequest(targetEmail)))
            .Content.ReadFromJsonAsync<InvitationResponse>())!;

        var (targetPerson, _) = await RegisterAndAuthenticateAsync(targetEmail);
        var firstAttempt = await targetPerson.PostAsync($"/invitations/{invitation.Token}/accept", content: null);
        var secondAttempt = await targetPerson.PostAsync($"/invitations/{invitation.Token}/accept", content: null);

        Assert.Equal(HttpStatusCode.OK, firstAttempt.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, secondAttempt.StatusCode);
    }

    [Fact]
    public async Task Invitation_Preview_Is_Accessible_Without_Authentication()
    {
        var (owner, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner, "Groupe Ouvert");

        var link = (await (await owner.PostAsync($"/groups/{group.Id}/invitations/link", content: null))
            .Content.ReadFromJsonAsync<InvitationResponse>())!;

        var anonymousClient = _factory.CreateClient();
        var previewResponse = await anonymousClient.GetAsync($"/invitations/{link.Token}");
        previewResponse.EnsureSuccessStatusCode();
        var preview = await previewResponse.Content.ReadFromJsonAsync<InvitationPreviewResponse>();

        Assert.Equal("Groupe Ouvert", preview!.GroupName);
        Assert.True(preview.IsValid);
    }

    [Fact]
    public async Task Groups_Are_Isolated_From_Each_Other()
    {
        var (ownerA, _) = await RegisterAndAuthenticateAsync();
        var (ownerB, _) = await RegisterAndAuthenticateAsync();

        var groupA = await CreateGroupAsync(ownerA, "Groupe A");
        var groupB = await CreateGroupAsync(ownerB, "Groupe B");

        var linkA = (await (await ownerA.PostAsync($"/groups/{groupA.Id}/invitations/link", content: null))
            .Content.ReadFromJsonAsync<InvitationResponse>())!;

        var (memberA, _) = await RegisterAndAuthenticateAsync();
        await memberA.PostAsync($"/invitations/{linkA.Token}/accept", content: null);

        // Un membre du groupe A ne voit rien du groupe B.
        var crossAccess = await memberA.GetAsync($"/groups/{groupB.Id}");
        Assert.Equal(HttpStatusCode.Forbidden, crossAccess.StatusCode);

        var mineResponse = await memberA.GetAsync("/groups");
        var mine = await mineResponse.Content.ReadFromJsonAsync<List<GroupResponse>>();
        Assert.DoesNotContain(mine!, g => g.Id == groupB.Id);
    }

    [Fact]
    public async Task Create_Group_Defaults_To_Email_Digest_Enabled()
    {
        var (client, _) = await RegisterAndAuthenticateAsync();

        var group = await CreateGroupAsync(client);

        Assert.True(group.EmailDigestEnabled);
    }

    [Fact]
    public async Task Member_Can_Opt_Out_Of_The_Email_Digest_For_A_Group()
    {
        var (client, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(client);

        var patchResponse = await client.PatchAsJsonAsync(
            $"/groups/{group.Id}/notifications", new UpdateGroupNotificationPreferenceRequest(false));
        Assert.Equal(HttpStatusCode.NoContent, patchResponse.StatusCode);

        var updated = await client.GetFromJsonAsync<GroupResponse>($"/groups/{group.Id}");
        Assert.False(updated!.EmailDigestEnabled);
    }

    [Fact]
    public async Task NonMember_Cannot_Change_Another_Groups_Email_Digest_Preference()
    {
        var (owner, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);

        var (outsider, _) = await RegisterAndAuthenticateAsync();
        var response = await outsider.PatchAsJsonAsync(
            $"/groups/{group.Id}/notifications", new UpdateGroupNotificationPreferenceRequest(false));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Admin_Can_Upload_And_Remove_The_Group_Image()
    {
        var (owner, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);

        using var form = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(TinyPng);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        form.Add(fileContent, "image", "photo.png");

        var uploadResponse = await owner.PostAsync($"/groups/{group.Id}/image", form);
        uploadResponse.EnsureSuccessStatusCode();
        var updated = await uploadResponse.Content.ReadFromJsonAsync<GroupResponse>();
        Assert.False(string.IsNullOrWhiteSpace(updated!.ImageUrl));

        var deleteResponse = await owner.DeleteAsync($"/groups/{group.Id}/image");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var afterDelete = await owner.GetFromJsonAsync<GroupResponse>($"/groups/{group.Id}");
        Assert.Null(afterDelete!.ImageUrl);
    }

    [Fact]
    public async Task NonAdmin_Member_Cannot_Upload_The_Group_Image()
    {
        var (owner, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);

        var link = (await (await owner.PostAsync($"/groups/{group.Id}/invitations/link", content: null))
            .Content.ReadFromJsonAsync<InvitationResponse>())!;
        var (member, _) = await RegisterAndAuthenticateAsync();
        await member.PostAsync($"/invitations/{link.Token}/accept", content: null);

        using var form = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(TinyPng);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        form.Add(fileContent, "image", "photo.png");

        var response = await member.PostAsync($"/groups/{group.Id}/image", form);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Admin_Can_Promote_A_Member_To_Admin_And_Demote_Back()
    {
        var (owner, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);
        var (member, memberUser) = await RegisterAndAuthenticateAsync();
        await JoinGroupAsync(owner, member, group.Id);

        var promote = await owner.PatchAsJsonAsync(
            $"/groups/{group.Id}/members/{memberUser.Id}/role", new UpdateMemberRoleRequest("Admin"));
        Assert.Equal(HttpStatusCode.NoContent, promote.StatusCode);

        var membersAfterPromote = await owner.GetFromJsonAsync<List<GroupMemberResponse>>($"/groups/{group.Id}/members");
        Assert.Equal("Admin", membersAfterPromote!.Single(m => m.UserId == memberUser.Id).Role);

        var demote = await owner.PatchAsJsonAsync(
            $"/groups/{group.Id}/members/{memberUser.Id}/role", new UpdateMemberRoleRequest("Member"));
        Assert.Equal(HttpStatusCode.NoContent, demote.StatusCode);

        var membersAfterDemote = await owner.GetFromJsonAsync<List<GroupMemberResponse>>($"/groups/{group.Id}/members");
        Assert.Equal("Member", membersAfterDemote!.Single(m => m.UserId == memberUser.Id).Role);
    }

    [Fact]
    public async Task NonAdmin_Cannot_Change_Member_Roles()
    {
        var (owner, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);
        var (member, memberUser) = await RegisterAndAuthenticateAsync();
        await JoinGroupAsync(owner, member, group.Id);

        var response = await member.PatchAsJsonAsync(
            $"/groups/{group.Id}/members/{memberUser.Id}/role", new UpdateMemberRoleRequest("Admin"));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Cannot_Change_Role_Of_The_Groups_Creator()
    {
        var (owner, ownerUser) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);

        var response = await owner.PatchAsJsonAsync(
            $"/groups/{group.Id}/members/{ownerUser.Id}/role", new UpdateMemberRoleRequest("Member"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Admin_Can_Grant_And_Revoke_Individual_Permissions_To_A_Member()
    {
        var (owner, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);
        var (member, memberUser) = await RegisterAndAuthenticateAsync();
        await JoinGroupAsync(owner, member, group.Id);

        var grant = await owner.PatchAsJsonAsync(
            $"/groups/{group.Id}/members/{memberUser.Id}/permissions",
            new UpdateMemberPermissionsRequest(CanInviteMembers: true, CanRemoveMembers: false, CanDeleteListings: true));
        Assert.Equal(HttpStatusCode.NoContent, grant.StatusCode);

        var members = await owner.GetFromJsonAsync<List<GroupMemberResponse>>($"/groups/{group.Id}/members");
        var updated = members!.Single(m => m.UserId == memberUser.Id);
        Assert.True(updated.CanInviteMembers);
        Assert.False(updated.CanRemoveMembers);
        Assert.True(updated.CanDeleteListings);

        var revoke = await owner.PatchAsJsonAsync(
            $"/groups/{group.Id}/members/{memberUser.Id}/permissions",
            new UpdateMemberPermissionsRequest(CanInviteMembers: false, CanRemoveMembers: false, CanDeleteListings: false));
        Assert.Equal(HttpStatusCode.NoContent, revoke.StatusCode);
    }

    [Fact]
    public async Task Cannot_Grant_Individual_Permissions_To_An_Admin()
    {
        var (owner, ownerUser) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);

        var response = await owner.PatchAsJsonAsync(
            $"/groups/{group.Id}/members/{ownerUser.Id}/permissions",
            new UpdateMemberPermissionsRequest(true, true, true));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Member_With_CanInviteMembers_Can_Generate_An_Invitation_Link()
    {
        var (owner, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);
        var (member, memberUser) = await RegisterAndAuthenticateAsync();
        await JoinGroupAsync(owner, member, group.Id);

        await owner.PatchAsJsonAsync(
            $"/groups/{group.Id}/members/{memberUser.Id}/permissions",
            new UpdateMemberPermissionsRequest(CanInviteMembers: true, CanRemoveMembers: false, CanDeleteListings: false));

        var response = await member.PostAsync($"/groups/{group.Id}/invitations/link", content: null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Admin_Can_Remove_A_Member()
    {
        var (owner, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);
        var (member, memberUser) = await RegisterAndAuthenticateAsync();
        await JoinGroupAsync(owner, member, group.Id);

        var response = await owner.DeleteAsync($"/groups/{group.Id}/members/{memberUser.Id}");
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var members = await owner.GetFromJsonAsync<List<GroupMemberResponse>>($"/groups/{group.Id}/members");
        Assert.DoesNotContain(members!, m => m.UserId == memberUser.Id);
    }

    [Fact]
    public async Task Member_With_CanRemoveMembers_Can_Remove_A_Non_Admin_But_Not_An_Admin()
    {
        var (owner, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);

        var (moderator, moderatorUser) = await RegisterAndAuthenticateAsync();
        await JoinGroupAsync(owner, moderator, group.Id);
        await owner.PatchAsJsonAsync(
            $"/groups/{group.Id}/members/{moderatorUser.Id}/permissions",
            new UpdateMemberPermissionsRequest(CanInviteMembers: false, CanRemoveMembers: true, CanDeleteListings: false));

        var (regular, regularUser) = await RegisterAndAuthenticateAsync();
        await JoinGroupAsync(owner, regular, group.Id);

        var (otherAdmin, otherAdminUser) = await RegisterAndAuthenticateAsync();
        await JoinGroupAsync(owner, otherAdmin, group.Id);
        await owner.PatchAsJsonAsync(
            $"/groups/{group.Id}/members/{otherAdminUser.Id}/role", new UpdateMemberRoleRequest("Admin"));

        var removeRegular = await moderator.DeleteAsync($"/groups/{group.Id}/members/{regularUser.Id}");
        Assert.Equal(HttpStatusCode.NoContent, removeRegular.StatusCode);

        var removeAdmin = await moderator.DeleteAsync($"/groups/{group.Id}/members/{otherAdminUser.Id}");
        Assert.Equal(HttpStatusCode.Forbidden, removeAdmin.StatusCode);
    }

    [Fact]
    public async Task Member_Without_Permission_Cannot_Remove_Another_Member()
    {
        var (owner, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);
        var (memberA, _) = await RegisterAndAuthenticateAsync();
        await JoinGroupAsync(owner, memberA, group.Id);
        var (memberB, memberBUser) = await RegisterAndAuthenticateAsync();
        await JoinGroupAsync(owner, memberB, group.Id);

        var response = await memberA.DeleteAsync($"/groups/{group.Id}/members/{memberBUser.Id}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Cannot_Remove_The_Groups_Creator()
    {
        var (owner, ownerUser) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);
        var (otherAdmin, otherAdminUser) = await RegisterAndAuthenticateAsync();
        await JoinGroupAsync(owner, otherAdmin, group.Id);
        await owner.PatchAsJsonAsync(
            $"/groups/{group.Id}/members/{otherAdminUser.Id}/role", new UpdateMemberRoleRequest("Admin"));

        var response = await otherAdmin.DeleteAsync($"/groups/{group.Id}/members/{ownerUser.Id}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Cannot_Remove_Self()
    {
        var (owner, ownerUser) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);

        var response = await owner.DeleteAsync($"/groups/{group.Id}/members/{ownerUser.Id}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Mine_Includes_Recent_Available_Listing_Thumbnails_As_Preview()
    {
        var (owner, _) = await RegisterAndAuthenticateAsync();
        var group = await CreateGroupAsync(owner);
        var categoryId = (await owner.GetFromJsonAsync<List<CategoryResponse>>("/categories"))!.First().Id;

        var form = new MultipartFormDataContent
        {
            { new StringContent("Vélo"), "Title" },
            { new StringContent("Sale"), "Mode" },
            { new StringContent(categoryId.ToString()), "CategoryId" },
            { new StringContent("DirectContact"), "ContactMode" },
            { new StringContent("10"), "Price" },
            { new StringContent("06 00 00 00 00"), "ContactDetails" },
        };
        var fileContent = new ByteArrayContent(TinyPng);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        form.Add(fileContent, "Images", "photo.png");

        var createResponse = await owner.PostAsync($"/groups/{group.Id}/listings", form);
        createResponse.EnsureSuccessStatusCode();

        var groups = await owner.GetFromJsonAsync<List<GroupResponse>>("/groups");
        var updatedGroup = groups!.Single(g => g.Id == group.Id);

        Assert.Single(updatedGroup.ListingPreviewUrls);
    }
}

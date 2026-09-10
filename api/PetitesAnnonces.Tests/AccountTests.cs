using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using PetitesAnnonces.Api.Contracts;
using Xunit;

namespace PetitesAnnonces.Tests;

public class AccountTests : IClassFixture<CustomWebApplicationFactory>
{
    // 1x1 PNG transparent minimal (même image de test que ListingsTests).
    private static readonly byte[] TinyPng = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");

    private readonly CustomWebApplicationFactory _factory;

    public AccountTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<(HttpClient Client, UserResponse User, string Email, string Password)> RegisterAndAuthenticateAsync()
    {
        var client = _factory.CreateClient();
        var email = $"user-{Guid.NewGuid():N}@example.com";
        const string password = "Str0ngPassw0rd!";
        var response = await client.PostAsJsonAsync("/auth/register", new RegisterRequest(email, password, "Jamy"));
        response.EnsureSuccessStatusCode();
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.AccessToken);
        return (client, auth.User, email, password);
    }

    [Fact]
    public async Task Get_Returns_The_Current_Users_Profile()
    {
        var (client, user, email, _) = await RegisterAndAuthenticateAsync();

        var account = await client.GetFromJsonAsync<AccountResponse>("/account");

        Assert.Equal(user.Id, account!.Id);
        Assert.Equal(email, account.Email);
        Assert.Equal("Jamy", account.DisplayName);
        Assert.Null(account.PhotoUrl);
    }

    [Fact]
    public async Task Update_Changes_Display_Name_And_Phone_Number()
    {
        var (client, _, _, _) = await RegisterAndAuthenticateAsync();

        var response = await client.PutAsJsonAsync("/account", new UpdateAccountRequest("Nouveau nom", "0600000000"));
        response.EnsureSuccessStatusCode();
        var account = await response.Content.ReadFromJsonAsync<AccountResponse>();

        Assert.Equal("Nouveau nom", account!.DisplayName);
        Assert.Equal("0600000000", account.PhoneNumber);
    }

    [Fact]
    public async Task Update_Rejects_An_Empty_Display_Name()
    {
        var (client, _, _, _) = await RegisterAndAuthenticateAsync();

        var response = await client.PutAsJsonAsync("/account", new UpdateAccountRequest("   ", null));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Upload_And_Delete_Photo_Round_Trip()
    {
        var (client, _, _, _) = await RegisterAndAuthenticateAsync();

        using var form = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(TinyPng);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        form.Add(fileContent, "photo", "avatar.png");

        var uploadResponse = await client.PostAsync("/account/photo", form);
        uploadResponse.EnsureSuccessStatusCode();
        var afterUpload = await uploadResponse.Content.ReadFromJsonAsync<AccountResponse>();
        Assert.False(string.IsNullOrWhiteSpace(afterUpload!.PhotoUrl));

        var deleteResponse = await client.DeleteAsync("/account/photo");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var afterDelete = await client.GetFromJsonAsync<AccountResponse>("/account");
        Assert.Null(afterDelete!.PhotoUrl);
    }

    [Fact]
    public async Task Change_Password_Requires_The_Correct_Current_Password()
    {
        var (client, _, _, password) = await RegisterAndAuthenticateAsync();

        var wrongAttempt = await client.PostAsJsonAsync(
            "/account/change-password", new ChangePasswordRequest("WrongPassword!", "N3wStr0ngPassw0rd!"));
        Assert.Equal(HttpStatusCode.BadRequest, wrongAttempt.StatusCode);

        var correctAttempt = await client.PostAsJsonAsync(
            "/account/change-password", new ChangePasswordRequest(password, "N3wStr0ngPassw0rd!"));
        Assert.Equal(HttpStatusCode.NoContent, correctAttempt.StatusCode);
    }

    [Fact]
    public async Task Change_Email_Updates_The_Login_Identifier()
    {
        var (client, _, _, password) = await RegisterAndAuthenticateAsync();
        var newEmail = $"new-{Guid.NewGuid():N}@example.com";

        var response = await client.PostAsJsonAsync("/account/change-email", new ChangeEmailRequest(newEmail, password));
        response.EnsureSuccessStatusCode();
        var account = await response.Content.ReadFromJsonAsync<AccountResponse>();
        Assert.Equal(newEmail, account!.Email);

        var loginResponse = await _factory.CreateClient().PostAsJsonAsync("/auth/login", new LoginRequest(newEmail, password));
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
    }

    [Fact]
    public async Task Change_Email_Rejects_An_Already_Used_Address()
    {
        var (client, _, _, password) = await RegisterAndAuthenticateAsync();
        var (_, _, otherEmail, _) = await RegisterAndAuthenticateAsync();

        var response = await client.PostAsJsonAsync("/account/change-email", new ChangeEmailRequest(otherEmail, password));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Change_Email_Requires_The_Correct_Current_Password()
    {
        var (client, _, _, _) = await RegisterAndAuthenticateAsync();

        var response = await client.PostAsJsonAsync(
            "/account/change-email", new ChangeEmailRequest($"new-{Guid.NewGuid():N}@example.com", "WrongPassword!"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}

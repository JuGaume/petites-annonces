using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using PetitesAnnonces.Api.Contracts;
using Xunit;

namespace PetitesAnnonces.Tests;

public class AuthTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public AuthTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private static RegisterRequest NewRegisterRequest() => new(
        Email: $"user-{Guid.NewGuid():N}@example.com",
        Password: "Str0ngPassw0rd!",
        DisplayName: "Jamy");

    [Fact]
    public async Task Register_Then_Me_Returns_The_New_User()
    {
        var client = _factory.CreateClient();
        var request = NewRegisterRequest();

        var registerResponse = await client.PostAsJsonAsync("/auth/register", request);
        Assert.Equal(HttpStatusCode.OK, registerResponse.StatusCode);

        var auth = await registerResponse.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);
        Assert.Equal(request.Email, auth!.User.Email);
        Assert.Contains("User", auth.User.Roles);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        var meResponse = await client.GetAsync("/auth/me");
        Assert.Equal(HttpStatusCode.OK, meResponse.StatusCode);

        var me = await meResponse.Content.ReadFromJsonAsync<UserResponse>();
        Assert.Equal(request.Email, me!.Email);
    }

    [Theory]
    [InlineData("not-an-email")]
    [InlineData("missing-domain@")]
    [InlineData("@missing-local.com")]
    [InlineData("no-at-sign.example.com")]
    public async Task Register_With_Invalid_Email_Format_Fails(string invalidEmail)
    {
        var client = _factory.CreateClient();
        var request = NewRegisterRequest() with { Email = invalidEmail };

        var response = await client.PostAsJsonAsync("/auth/register", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Register_With_Existing_Email_Fails()
    {
        var client = _factory.CreateClient();
        var request = NewRegisterRequest();

        await client.PostAsJsonAsync("/auth/register", request);
        var secondAttempt = await client.PostAsJsonAsync("/auth/register", request);

        Assert.False(secondAttempt.IsSuccessStatusCode);
    }

    [Fact]
    public async Task Login_With_Correct_Password_Succeeds()
    {
        var client = _factory.CreateClient();
        var request = NewRegisterRequest();
        await client.PostAsJsonAsync("/auth/register", request);

        var loginResponse = await client.PostAsJsonAsync("/auth/login", new LoginRequest(request.Email, request.Password));

        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
    }

    [Fact]
    public async Task Login_With_Wrong_Password_Returns_Unauthorized()
    {
        var client = _factory.CreateClient();
        var request = NewRegisterRequest();
        await client.PostAsJsonAsync("/auth/register", request);

        var loginResponse = await client.PostAsJsonAsync("/auth/login", new LoginRequest(request.Email, "MauvaisMotDePasse!"));

        Assert.Equal(HttpStatusCode.Unauthorized, loginResponse.StatusCode);
    }

    [Fact]
    public async Task Me_Without_Token_Is_Unauthorized()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Refresh_With_Valid_Cookie_Issues_A_New_Access_Token()
    {
        var client = _factory.CreateClient();
        var request = NewRegisterRequest();

        var registerResponse = await client.PostAsJsonAsync("/auth/register", request);
        var refreshCookie = ExtractCookie(registerResponse, "refreshToken");
        Assert.NotNull(refreshCookie);

        using var refreshRequest = new HttpRequestMessage(HttpMethod.Post, "/auth/refresh");
        refreshRequest.Headers.Add("Cookie", $"refreshToken={refreshCookie}");

        var refreshResponse = await client.SendAsync(refreshRequest);

        Assert.Equal(HttpStatusCode.OK, refreshResponse.StatusCode);
        var auth = await refreshResponse.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth?.AccessToken);
    }

    [Fact]
    public async Task Refresh_Without_Cookie_Is_Unauthorized()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsync("/auth/refresh", content: null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private static string? ExtractCookie(HttpResponseMessage response, string cookieName)
    {
        if (!response.Headers.TryGetValues("Set-Cookie", out var cookies))
        {
            return null;
        }

        foreach (var cookie in cookies)
        {
            if (cookie.StartsWith($"{cookieName}=", StringComparison.OrdinalIgnoreCase))
            {
                var valuePart = cookie.Split(';')[0];
                return valuePart[(cookieName.Length + 1)..];
            }
        }

        return null;
    }
}

using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using FluentValidation;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
using PetitesAnnonces.Api.Auth;
using PetitesAnnonces.Api.Contracts;
using PetitesAnnonces.Api.Data;
using PetitesAnnonces.Api.Email;
using PetitesAnnonces.Api.Models;
using PetitesAnnonces.Api.Storage;
using PetitesAnnonces.Api.Validation;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

const string FrontendCorsPolicy = "Frontend";
var frontendOrigins = builder.Configuration.GetSection("Cors:FrontendOrigins").Get<string[]>()
    ?? ["http://localhost:5173"];

builder.Services.AddCors(options =>
{
    options.AddPolicy(FrontendCorsPolicy, policy =>
        policy.WithOrigins(frontendOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials());
});

// Le fournisseur InMemory (choisi via "Database:UseInMemory") n'est utilisé que par
// les tests d'intégration, pour ne pas dépendre de LocalDB/SQL Server en CI.
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    if (builder.Configuration.GetValue<bool>("Database:UseInMemory"))
    {
        options.UseInMemoryDatabase(builder.Configuration["Database:InMemoryName"] ?? "petites-annonces");
    }
    else
    {
        options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"));
    }
});

builder.Services
    .AddIdentityCore<ApplicationUser>(options =>
    {
        options.Password.RequiredLength = 8;
        options.User.RequireUniqueEmail = true;
    })
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddSignInManager();

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.SectionName));
builder.Services.Configure<GoogleAuthOptions>(builder.Configuration.GetSection(GoogleAuthOptions.SectionName));
builder.Services.AddScoped<ITokenService, TokenService>();

var jwtSection = builder.Configuration.GetSection(JwtOptions.SectionName);
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtSection["Issuer"],
            ValidateAudience = true,
            ValidAudience = jwtSection["Audience"],
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Convert.FromBase64String(jwtSection["SigningKey"]!)),
            ClockSkew = TimeSpan.FromSeconds(30),
        };
    });

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IAuthorizationHandler, GroupMembershipAuthorizationHandler>();
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(GroupPolicies.Member, policy => policy.Requirements.Add(new GroupMembershipRequirement(requireAdmin: false)));
    options.AddPolicy(GroupPolicies.Admin, policy => policy.Requirements.Add(new GroupMembershipRequirement(requireAdmin: true)));
});

builder.Services.Configure<SendGridOptions>(builder.Configuration.GetSection(SendGridOptions.SectionName));
// Sans clé SendGrid configurée (dev/tests), on se contente de logguer l'email au lieu
// de tenter un envoi réel.
if (string.IsNullOrWhiteSpace(builder.Configuration[$"{SendGridOptions.SectionName}:ApiKey"]))
{
    builder.Services.AddSingleton<IEmailSender, LoggingEmailSender>();
}
else
{
    builder.Services.AddSingleton<IEmailSender, SendGridEmailSender>();
}

builder.Services.Configure<BlobStorageOptions>(builder.Configuration.GetSection(BlobStorageOptions.SectionName));
// Sans chaîne de connexion Azure Storage configurée (dev/tests), les photos sont
// enregistrées sur le disque de l'API plutôt que de dépendre d'un conteneur (Azurite).
var useAzureBlobStorage = !string.IsNullOrWhiteSpace(builder.Configuration[$"{BlobStorageOptions.SectionName}:AzureConnectionString"]);
if (useAzureBlobStorage)
{
    builder.Services.AddSingleton<IBlobStorageService, AzureBlobStorageService>();
}
else
{
    builder.Services.AddScoped<IBlobStorageService, LocalDiskBlobStorageService>();
}

builder.Services.AddScoped<IValidator<CreateListingRequest>, CreateListingRequestValidator>();

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddFixedWindowLimiter(RateLimiting.AuthPolicy, opt =>
    {
        // Configurable pour permettre aux tests d'intégration de désactiver la
        // limite (nombreuses requêtes dans un même run) sans changer le
        // comportement par défaut en production.
        opt.PermitLimit = builder.Configuration.GetValue("RateLimiting:Auth:PermitLimit", 10);
        opt.Window = TimeSpan.FromSeconds(builder.Configuration.GetValue("RateLimiting:Auth:WindowSeconds", 60));
        opt.QueueLimit = 0;
    });
});

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

    // En test d'intégration, la base InMemory n'est pas relationnelle et ne
    // supporte pas les migrations : on se contente de créer le schéma.
    if (db.Database.IsRelational())
    {
        db.Database.Migrate();
    }
    else
    {
        db.Database.EnsureCreated();
    }

    await DbSeeder.SeedAsync(scope.ServiceProvider);
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

if (!useAzureBlobStorage)
{
    var blobOptions = app.Services.GetRequiredService<IOptions<BlobStorageOptions>>().Value;
    var localUploadsRoot = Path.Combine(app.Environment.ContentRootPath, blobOptions.LocalRootPath);
    Directory.CreateDirectory(localUploadsRoot);

    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(localUploadsRoot),
        RequestPath = blobOptions.LocalRequestPath,
    });
}

app.UseCors(FrontendCorsPolicy);

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Run();

// Rend le point d'entrée accessible aux tests d'intégration (WebApplicationFactory).
public partial class Program { }

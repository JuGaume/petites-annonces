using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PetitesAnnonces.Api.Data;
using PetitesAnnonces.Api.Email;

namespace PetitesAnnonces.Api.Notifications;

/// <summary>
/// Envoie le digest quotidien des nouvelles annonces par groupe (spec §7). Tourne dans
/// le processus de l'API (pas de ressource Azure séparée à cette échelle) ; la
/// sélection des annonces reste dans <see cref="IDigestBuilder"/> pour rester testable
/// indépendamment de la planification et de l'envoi d'email.
/// </summary>
public class DailyDigestService(
    IServiceScopeFactory scopeFactory,
    IOptions<DigestOptions> options,
    ILogger<DailyDigestService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var interval = TimeSpan.FromHours(Math.Max(options.Value.IntervalHours, 0.1));
        using var timer = new PeriodicTimer(interval);

        do
        {
            try
            {
                await RunOnceAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(ex, "Échec de l'envoi du digest quotidien.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    /// <summary>
    /// Exécute un envoi immédiatement, indépendamment du minuteur — utilisé par le
    /// minuteur lui-même et par l'endpoint de déclenchement manuel (dev/admin).
    /// </summary>
    public async Task RunOnceAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var digestBuilder = scope.ServiceProvider.GetRequiredService<IDigestBuilder>();
        var emailSender = scope.ServiceProvider.GetRequiredService<IEmailSender>();
        var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();

        var now = DateTimeOffset.UtcNow;
        var digests = await digestBuilder.BuildPendingDigestsAsync(now, cancellationToken);

        foreach (var digest in digests)
        {
            var groupUrl = BuildGroupUrl(configuration, digest.GroupId);
            var html = DigestEmailTemplate.Render(digest, groupUrl);

            await emailSender.SendAsync(
                digest.UserEmail,
                $"Nouvelles annonces dans « {digest.GroupName} »",
                html,
                cancellationToken);

            var membership = await db.GroupMemberships.FirstOrDefaultAsync(
                m => m.GroupId == digest.GroupId && m.UserId == digest.UserId, cancellationToken);
            if (membership is not null)
            {
                membership.LastDigestSentAt = now;
            }
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private static string BuildGroupUrl(IConfiguration configuration, int groupId)
    {
        var baseUrl = (configuration["Frontend:BaseUrl"] ?? "http://localhost:5173").TrimEnd('/');
        return $"{baseUrl}/groups/{groupId}/listings";
    }
}

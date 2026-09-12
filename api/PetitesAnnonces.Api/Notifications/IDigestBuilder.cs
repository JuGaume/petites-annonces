namespace PetitesAnnonces.Api.Notifications;

/// <summary>
/// Sélectionne, pour chaque membre abonné, les annonces de ses groupes créées depuis
/// son dernier digest (spec §7, notifications email). Logique isolée de l'envoi
/// (<see cref="DailyDigestService"/>) pour rester testable sans e-mail ni planification.
/// </summary>
public interface IDigestBuilder
{
    Task<IReadOnlyList<GroupDigest>> BuildPendingDigestsAsync(DateTimeOffset now, CancellationToken cancellationToken = default);

    /// <summary>Alertes de recherche enregistrée (feature "alertes") ayant de nouvelles annonces correspondantes depuis leur dernière notification.</summary>
    Task<IReadOnlyList<SavedSearchAlert>> BuildSavedSearchAlertsAsync(DateTimeOffset now, CancellationToken cancellationToken = default);
}

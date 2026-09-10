namespace PetitesAnnonces.Api.Notifications;

public class DigestOptions
{
    public const string SectionName = "Digest";

    /// <summary>Intervalle entre deux envois. "Quotidien" par défaut ; réduit en dev pour tester plus vite.</summary>
    public double IntervalHours { get; set; } = 24;
}

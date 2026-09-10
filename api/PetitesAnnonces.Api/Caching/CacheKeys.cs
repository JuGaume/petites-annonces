namespace PetitesAnnonces.Api.Caching;

public static class CacheKeys
{
    /// <summary>Liste des catégories (peu volatile, spec §9) — invalidée explicitement par AdminController.</summary>
    public const string Categories = "categories:all";
}

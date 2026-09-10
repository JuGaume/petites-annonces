namespace PetitesAnnonces.Api.Models;

/// <summary>Catégorie d'annonce. Liste fixe, gérée par l'admin (semée par <c>DbSeeder</c>).</summary>
public class Category
{
    public int Id { get; set; }

    public required string Name { get; set; }
}

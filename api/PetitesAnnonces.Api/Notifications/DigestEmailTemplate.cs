using System.Net;
using System.Text;

namespace PetitesAnnonces.Api.Notifications;

/// <summary>Template simple : liste des nouvelles annonces + lien vers le groupe (spec §7).</summary>
public static class DigestEmailTemplate
{
    public static string Render(GroupDigest digest, string groupUrl)
    {
        var items = new StringBuilder();
        foreach (var listing in digest.NewListings)
        {
            var price = listing.Price is not null ? $" — {listing.Price} €" : string.Empty;
            items.Append($"<li>{WebUtility.HtmlEncode(listing.Title)}{price}</li>");
        }

        return $"""
            <p>Bonjour {WebUtility.HtmlEncode(digest.UserDisplayName)},</p>
            <p>{digest.NewListings.Count} nouvelle(s) annonce(s) dans le groupe <strong>{WebUtility.HtmlEncode(digest.GroupName)}</strong> depuis votre dernier résumé :</p>
            <ul>{items}</ul>
            <p><a href="{groupUrl}">Voir les annonces du groupe</a></p>
            <p style="color:#6b7280;font-size:12px">Vous pouvez vous désabonner de ce résumé pour ce groupe depuis sa page de détail.</p>
            """;
    }
}

namespace PetitesAnnonces.Api.Models;

public enum GroupInvitationType
{
    /// <summary>Lien partageable, réutilisable jusqu'à révocation.</summary>
    Link,

    /// <summary>Invitation nominative envoyée par email, à usage unique.</summary>
    Email,
}

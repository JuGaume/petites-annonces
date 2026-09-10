namespace PetitesAnnonces.Api.Auth;

public static class GroupPolicies
{
    /// <summary>Requiert d'être membre (n'importe quel rôle) du groupe de la route.</summary>
    public const string Member = "GroupMember";

    /// <summary>Requiert d'être membre avec le rôle <see cref="Models.GroupMemberRole.Admin"/>.</summary>
    public const string Admin = "GroupAdmin";
}

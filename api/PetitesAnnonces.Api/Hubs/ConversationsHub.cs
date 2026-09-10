using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using PetitesAnnonces.Api.Data;

namespace PetitesAnnonces.Api.Hubs;

/// <summary>
/// Diffusion temps réel des nouveaux messages. L'écriture (persistance) reste faite via
/// l'API REST (<c>ConversationsController</c>), qui pousse ensuite l'événement aux
/// clients connectés à ce hub — voir spec §7 (messagerie interne).
/// </summary>
[Authorize]
public class ConversationsHub(ApplicationDbContext db) : Hub
{
    public static string GroupName(int conversationId) => $"conversation-{conversationId}";

    /// <summary>
    /// À appeler par le client à l'ouverture d'un fil de discussion, pour recevoir les
    /// messages qui y sont postés en temps réel. Rejette si l'appelant n'est ni
    /// l'acheteur ni le vendeur de cette conversation.
    /// </summary>
    public async Task JoinConversation(int conversationId)
    {
        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var isParticipant = userId is not null && await db.Conversations
            .AnyAsync(c => c.Id == conversationId && (c.BuyerUserId == userId || c.SellerUserId == userId));

        if (!isParticipant)
        {
            throw new HubException("Vous ne participez pas à cette conversation.");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(conversationId));
    }

    public Task LeaveConversation(int conversationId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(conversationId));
}

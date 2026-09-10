using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using PetitesAnnonces.Api.Auth;
using PetitesAnnonces.Api.Contracts;
using PetitesAnnonces.Api.Data;
using PetitesAnnonces.Api.Hubs;
using PetitesAnnonces.Api.Models;

namespace PetitesAnnonces.Api.Controllers;

/// <summary>
/// Conversations acheteur/vendeur liées à une annonce en mode <see
/// cref="ContactMode.InternalMessaging"/>. Une conversation n'appartient à aucun groupe
/// dans son adressage (elle est identifiée par son propre id) : l'autorisation est donc
/// vérifiée au cas par cas (être l'acheteur ou le vendeur), sauf pour l'ouverture depuis
/// une annonce qui reste scopée au groupe (<see cref="GroupPolicies.Member"/>).
/// </summary>
[ApiController]
[Route("conversations")]
[Authorize]
public class ConversationsController(ApplicationDbContext db, IHubContext<ConversationsHub> hub) : ControllerBase
{
    private const int MaxContentLength = 2000;
    private const int MessagesPageSize = 50;

    private string CurrentUserId => User.FindFirst(ClaimTypes.NameIdentifier)!.Value;

    /// <summary>Récupère la conversation existante entre l'appelant (acheteur) et l'auteur de l'annonce, ou la crée.</summary>
    [HttpPost("/groups/{groupId:int}/listings/{listingId:int}/conversations")]
    [Authorize(Policy = GroupPolicies.Member)]
    public async Task<ActionResult<ConversationResponse>> StartOrGet(int groupId, int listingId)
    {
        var listing = await db.Listings.AsNoTracking().FirstOrDefaultAsync(l => l.Id == listingId && l.GroupId == groupId);
        if (listing is null)
        {
            return NotFound();
        }

        if (listing.AuthorUserId == CurrentUserId)
        {
            return ValidationProblem("Vous ne pouvez pas contacter votre propre annonce.");
        }

        var conversation = await db.Conversations
            .FirstOrDefaultAsync(c => c.ListingId == listingId && c.BuyerUserId == CurrentUserId);

        if (conversation is null)
        {
            conversation = new Conversation
            {
                ListingId = listingId,
                BuyerUserId = CurrentUserId,
                SellerUserId = listing.AuthorUserId,
            };
            db.Conversations.Add(conversation);
            await db.SaveChangesAsync();
        }

        return await ConversationsQuery(conversation.Id).FirstAsync();
    }

    [HttpGet]
    public async Task<ActionResult<List<ConversationResponse>>> Mine()
    {
        return await ConversationsQuery(participantUserId: CurrentUserId).ToListAsync();
    }

    [HttpGet("{conversationId:int}/messages")]
    public async Task<ActionResult<List<MessageResponse>>> GetMessages(int conversationId, [FromQuery] int page = 1)
    {
        var conversation = await db.Conversations.AsNoTracking().FirstOrDefaultAsync(c => c.Id == conversationId);
        if (conversation is null)
        {
            return NotFound();
        }

        if (conversation.BuyerUserId != CurrentUserId && conversation.SellerUserId != CurrentUserId)
        {
            return Forbid();
        }

        page = Math.Max(page, 1);

        // Historique le plus récent en premier pour la pagination (charger plus haut),
        // puis remis dans l'ordre chronologique pour l'affichage.
        var messages = await db.Messages
            .AsNoTracking()
            .Where(m => m.ConversationId == conversationId)
            .Join(db.Users, m => m.AuthorUserId, u => u.Id, (m, u) => new { Message = m, Author = u })
            .OrderByDescending(x => x.Message.CreatedAt)
            .Skip((page - 1) * MessagesPageSize)
            .Take(MessagesPageSize)
            .Select(x => new MessageResponse(
                x.Message.Id, x.Message.ConversationId, x.Message.AuthorUserId, x.Author.DisplayName, x.Message.Content, x.Message.CreatedAt))
            .ToListAsync();

        messages.Reverse();
        return messages;
    }

    [HttpPost("{conversationId:int}/messages")]
    public async Task<ActionResult<MessageResponse>> SendMessage(int conversationId, SendMessageRequest request)
    {
        var content = request.Content?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(content))
        {
            return ValidationProblem("Le message ne peut pas être vide.");
        }

        if (content.Length > MaxContentLength)
        {
            return ValidationProblem($"Le message ne peut pas dépasser {MaxContentLength} caractères.");
        }

        var conversation = await db.Conversations.FirstOrDefaultAsync(c => c.Id == conversationId);
        if (conversation is null)
        {
            return NotFound();
        }

        if (conversation.BuyerUserId != CurrentUserId && conversation.SellerUserId != CurrentUserId)
        {
            return Forbid();
        }

        var message = new Message
        {
            ConversationId = conversationId,
            AuthorUserId = CurrentUserId,
            Content = content,
        };
        db.Messages.Add(message);
        await db.SaveChangesAsync();

        var author = await db.Users.AsNoTracking().FirstAsync(u => u.Id == CurrentUserId);
        var response = new MessageResponse(message.Id, conversationId, CurrentUserId, author.DisplayName, message.Content, message.CreatedAt);

        await hub.Clients.Group(ConversationsHub.GroupName(conversationId)).SendAsync("ReceiveMessage", response);

        return response;
    }

    private IQueryable<ConversationResponse> ConversationsQuery(int? conversationId = null, string? participantUserId = null)
    {
        var query = db.Conversations.AsNoTracking().AsQueryable();
        if (conversationId is not null)
        {
            query = query.Where(c => c.Id == conversationId);
        }

        if (participantUserId is not null)
        {
            query = query.Where(c => c.BuyerUserId == participantUserId || c.SellerUserId == participantUserId);
        }

        // Trié avant la projection en ConversationResponse : un OrderBy sur le résultat
        // déjà projeté ne se traduit pas en SQL sur SQL Server (même problème que
        // GroupsController.Members, non détecté par les tests sur fournisseur InMemory).
        query = query.OrderByDescending(c =>
            c.Messages.OrderByDescending(m => m.CreatedAt).Select(m => (DateTimeOffset?)m.CreatedAt).FirstOrDefault() ?? c.CreatedAt);

        return query
            .Join(db.Listings, c => c.ListingId, l => l.Id, (c, l) => new { Conversation = c, Listing = l })
            .Join(db.Users, cl => cl.Conversation.BuyerUserId, u => u.Id, (cl, buyer) => new { cl.Conversation, cl.Listing, Buyer = buyer })
            .Join(db.Users, clb => clb.Conversation.SellerUserId, u => u.Id, (clb, seller) => new { clb.Conversation, clb.Listing, clb.Buyer, Seller = seller })
            .Select(x => new ConversationResponse(
                x.Conversation.Id,
                x.Conversation.ListingId,
                x.Listing.Title,
                x.Listing.Images.OrderBy(i => i.Position).Select(i => i.ThumbnailUrl).FirstOrDefault(),
                x.Conversation.BuyerUserId,
                x.Buyer.DisplayName,
                x.Conversation.SellerUserId,
                x.Seller.DisplayName,
                x.Conversation.CreatedAt,
                x.Conversation.Messages.OrderByDescending(m => m.CreatedAt).Select(m => m.Content).FirstOrDefault(),
                x.Conversation.Messages.OrderByDescending(m => m.CreatedAt).Select(m => m.AuthorUserId).FirstOrDefault(),
                x.Conversation.Messages.OrderByDescending(m => m.CreatedAt).Select(m => (DateTimeOffset?)m.CreatedAt).FirstOrDefault()));
    }
}

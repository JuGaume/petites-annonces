namespace PetitesAnnonces.Api.Models;

public class Message
{
    public int Id { get; set; }

    public int ConversationId { get; set; }

    public Conversation? Conversation { get; set; }

    public required string AuthorUserId { get; set; }

    public required string Content { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

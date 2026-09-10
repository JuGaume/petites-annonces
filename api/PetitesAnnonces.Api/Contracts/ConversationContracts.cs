namespace PetitesAnnonces.Api.Contracts;

public record ConversationResponse(
    int Id,
    int ListingId,
    string ListingTitle,
    string? ListingThumbnailUrl,
    string BuyerUserId,
    string BuyerDisplayName,
    string SellerUserId,
    string SellerDisplayName,
    DateTimeOffset CreatedAt,
    string? LastMessageContent,
    string? LastMessageAuthorUserId,
    DateTimeOffset? LastMessageAt);

public record MessageResponse(
    int Id,
    int ConversationId,
    string AuthorUserId,
    string AuthorDisplayName,
    string Content,
    DateTimeOffset CreatedAt);

public record SendMessageRequest(string Content);

namespace PetitesAnnonces.Api.Contracts;

public record AdminUserResponse(
    string Id,
    string Email,
    string DisplayName,
    IReadOnlyList<string> Roles,
    bool IsDisabled);

public record AdminGroupResponse(
    int Id,
    string Name,
    string? Description,
    string CreatedByUserId,
    DateTimeOffset CreatedAt,
    int MemberCount);

public record AdminListingResponse(
    int Id,
    string Title,
    int GroupId,
    string GroupName,
    string AuthorUserId,
    string AuthorDisplayName,
    string Status,
    DateTimeOffset CreatedAt);

public record CreateCategoryRequest(string Name);

public record AuditLogEntryResponse(
    int Id,
    string AdminUserId,
    string AdminDisplayName,
    string Action,
    string? TargetId,
    string? Details,
    DateTimeOffset CreatedAt);

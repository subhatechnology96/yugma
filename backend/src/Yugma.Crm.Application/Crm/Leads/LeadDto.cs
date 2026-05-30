namespace Yugma.Crm.Application.Crm.Leads;

public sealed record LeadDto(
    Guid Id,
    string Code,
    string FullName,
    string Company,
    string Email,
    string Phone,
    string Source,
    string Status,
    int Score,
    string Owner,
    Guid? ConvertedDealId,
    Guid? ConvertedAccountId,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

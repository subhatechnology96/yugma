using Yugma.Crm.Domain.Crm;

namespace Yugma.Crm.Application.Crm.Contacts;

public sealed record ContactDto(
    Guid Id,
    string FullName,
    string Email,
    string Phone,
    string? Title,
    Guid AccountId,
    string AccountName,
    string Owner,
    bool IsPrimary,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

internal static class ContactMapping
{
    public static ContactDto ToDto(this Contact c, string accountName) => new(
        c.Id, c.Name.Full, c.Email.Value, c.Phone.Value, c.Title,
        c.AccountId, accountName, c.Owner, c.IsPrimary, c.CreatedAt, c.UpdatedAt);
}

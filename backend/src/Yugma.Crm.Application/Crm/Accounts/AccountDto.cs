using Yugma.Crm.Application.Crm.Common;
using Yugma.Crm.Domain.Crm;

namespace Yugma.Crm.Application.Crm.Accounts;

public sealed record AccountDto(
    Guid Id,
    string Name,
    string? Industry,
    string? Website,
    string? Phone,
    string? Size,
    decimal AnnualRevenue,
    string Owner,
    string Status,
    Guid? CustomerRef,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

internal static class AccountMapping
{
    public static AccountDto ToDto(this Account a) => new(
        a.Id, a.Name, a.Industry, a.Website, a.Phone, a.Size,
        a.AnnualRevenue, a.Owner, a.Status.ToWire(), a.CustomerRef, a.CreatedAt, a.UpdatedAt);
}

using Yugma.Crm.Domain.Crm;

namespace Yugma.Crm.Application.Crm.Deals;

internal static class DealMapping
{
    public static string ToWire(this DealStatus status) => status switch
    {
        DealStatus.Won => "won",
        DealStatus.Lost => "lost",
        _ => "open"
    };

    public static DealDto ToDto(this Deal d, string accountName, string stageName, string? contactName = null) => new(
        d.Id,
        d.Code,
        d.Name,
        d.AccountId,
        accountName,
        d.ContactId,
        contactName,
        d.Value,
        d.StageId,
        stageName,
        d.Status.ToWire(),
        d.Probability,
        d.CloseDate,
        d.Owner,
        d.LastActivityAt,
        d.CreatedAt,
        d.UpdatedAt);
}

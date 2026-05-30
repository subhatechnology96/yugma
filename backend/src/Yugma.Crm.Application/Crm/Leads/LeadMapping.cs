using Yugma.Crm.Domain.Crm;

namespace Yugma.Crm.Application.Crm.Leads;

internal static class LeadMapping
{
    public static string ToWire(this LeadStatus status) => status switch
    {
        LeadStatus.New => "new",
        LeadStatus.Working => "working",
        LeadStatus.Qualified => "qualified",
        LeadStatus.Unqualified => "unqualified",
        _ => "converted"
    };

    public static string ToWire(this LeadSource source) => source switch
    {
        LeadSource.ColdCall => "Cold call",
        _ => source.ToString()
    };

    public static LeadStatus ParseStatus(string? wire) => wire?.ToLowerInvariant() switch
    {
        "working" => LeadStatus.Working,
        "qualified" => LeadStatus.Qualified,
        "unqualified" => LeadStatus.Unqualified,
        "converted" => LeadStatus.Converted,
        _ => LeadStatus.New
    };

    public static LeadSource ParseSource(string? wire)
    {
        var normalized = (wire ?? "").Replace(" ", "").Trim();
        return Enum.TryParse<LeadSource>(normalized, ignoreCase: true, out var s) ? s : LeadSource.Other;
    }

    public static LeadDto ToDto(this Lead l) => new(
        l.Id,
        l.Code,
        l.Name.Full,
        l.Company,
        l.Email.Value,
        l.Phone.Value,
        l.Source.ToWire(),
        l.Status.ToWire(),
        l.Score,
        l.Owner,
        l.ConvertedDealId,
        l.ConvertedAccountId,
        l.CreatedAt,
        l.UpdatedAt);
}

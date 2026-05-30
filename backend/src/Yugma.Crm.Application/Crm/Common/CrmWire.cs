using Yugma.Crm.Domain.Crm;

namespace Yugma.Crm.Application.Crm.Common;

// Enum <-> wire-string conversions shared across CRM DTO mappings.
internal static class CrmWire
{
    public static string ToWire(this CrmEntityType t) => t switch
    {
        CrmEntityType.Account => "account",
        CrmEntityType.Contact => "contact",
        CrmEntityType.Deal => "deal",
        _ => "lead"
    };

    public static CrmEntityType ParseEntityType(string? w) => w?.ToLowerInvariant() switch
    {
        "account" => CrmEntityType.Account,
        "contact" => CrmEntityType.Contact,
        "deal" => CrmEntityType.Deal,
        _ => CrmEntityType.Lead
    };

    public static string ToWire(this ActivityType t) => t switch
    {
        ActivityType.Call => "call",
        ActivityType.Email => "email",
        ActivityType.Meeting => "meeting",
        _ => "task"
    };

    public static ActivityType ParseActivityType(string? w) => w?.ToLowerInvariant() switch
    {
        "call" => ActivityType.Call,
        "email" => ActivityType.Email,
        "meeting" => ActivityType.Meeting,
        _ => ActivityType.Task
    };

    public static string ToWire(this ActivityStatus s) => s == ActivityStatus.Done ? "done" : "open";

    public static string ToWire(this AccountStatus s) => s switch
    {
        AccountStatus.Customer => "customer",
        AccountStatus.Churned => "churned",
        _ => "prospect"
    };

    public static AccountStatus ParseAccountStatus(string? w) => w?.ToLowerInvariant() switch
    {
        "customer" => AccountStatus.Customer,
        "churned" => AccountStatus.Churned,
        _ => AccountStatus.Prospect
    };
}

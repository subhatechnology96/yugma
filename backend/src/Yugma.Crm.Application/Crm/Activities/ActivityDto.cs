using Yugma.Crm.Application.Crm.Common;
using Yugma.Crm.Domain.Crm;

namespace Yugma.Crm.Application.Crm.Activities;

public sealed record ActivityDto(
    Guid Id,
    string Type,
    string Subject,
    DateTime DueAt,
    DateTime? CompletedAt,
    string Status,
    string RelatedToType,
    Guid RelatedToId,
    string Owner,
    DateTime? ReminderAt,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

internal static class ActivityMapping
{
    public static ActivityDto ToDto(this Activity a) => new(
        a.Id, a.Type.ToWire(), a.Subject, a.DueAt, a.CompletedAt, a.Status.ToWire(),
        a.RelatedToType.ToWire(), a.RelatedToId, a.Owner, a.ReminderAt, a.CreatedAt, a.UpdatedAt);
}

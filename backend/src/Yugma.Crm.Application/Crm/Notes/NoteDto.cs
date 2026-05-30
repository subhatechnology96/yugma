using Yugma.Crm.Application.Crm.Common;
using Yugma.Crm.Domain.Crm;

namespace Yugma.Crm.Application.Crm.Notes;

public sealed record NoteDto(
    Guid Id,
    string Body,
    string RelatedToType,
    Guid RelatedToId,
    string Author,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

internal static class NoteMapping
{
    public static NoteDto ToDto(this Note n) => new(
        n.Id, n.Body, n.RelatedToType.ToWire(), n.RelatedToId, n.Author, n.CreatedAt, n.UpdatedAt);
}

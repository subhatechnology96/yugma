using Yugma.Crm.Application.Crm.Common;
using Yugma.Crm.Domain.Crm;
using Yugma.Crm.Shared.Results;
using MediatR;

namespace Yugma.Crm.Application.Crm.Notes;

public sealed record ListNotesByRelatedQuery(string RelatedToType, Guid RelatedToId)
    : IRequest<Result<IReadOnlyList<NoteDto>>>;

internal sealed class ListNotesByRelatedHandler(INoteRepository repo)
    : IRequestHandler<ListNotesByRelatedQuery, Result<IReadOnlyList<NoteDto>>>
{
    public async Task<Result<IReadOnlyList<NoteDto>>> Handle(ListNotesByRelatedQuery req, CancellationToken ct)
    {
        var type = CrmWire.ParseEntityType(req.RelatedToType);
        var list = (await repo.ListByRelatedAsync(type, req.RelatedToId, ct))
            .Select(NoteMapping.ToDto).ToList();
        return Result.Success<IReadOnlyList<NoteDto>>(list);
    }
}

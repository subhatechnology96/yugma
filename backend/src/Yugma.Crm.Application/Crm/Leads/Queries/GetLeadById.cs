using Yugma.Crm.Domain.Crm;
using Yugma.Crm.Shared.Results;
using MediatR;

namespace Yugma.Crm.Application.Crm.Leads.Queries;

public sealed record GetLeadByIdQuery(Guid Id) : IRequest<Result<LeadDto>>;

internal sealed class GetLeadByIdHandler(ILeadRepository repo)
    : IRequestHandler<GetLeadByIdQuery, Result<LeadDto>>
{
    public async Task<Result<LeadDto>> Handle(GetLeadByIdQuery req, CancellationToken ct)
    {
        var lead = await repo.GetAsync(req.Id, ct);
        return lead is null
            ? Result.Failure<LeadDto>(Error.NotFound($"Lead {req.Id} not found."))
            : lead.ToDto();
    }
}

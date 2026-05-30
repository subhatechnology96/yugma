using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.Crm;
using Yugma.Crm.Shared.Results;
using MediatR;

namespace Yugma.Crm.Application.Crm.Leads.Commands;

public sealed record ChangeLeadStatusCommand(Guid Id, string Status) : IRequest<Result<LeadDto>>;

internal sealed class ChangeLeadStatusHandler(
    ILeadRepository repo,
    IUnitOfWork uow,
    ITenantContext tenant)
    : IRequestHandler<ChangeLeadStatusCommand, Result<LeadDto>>
{
    public async Task<Result<LeadDto>> Handle(ChangeLeadStatusCommand req, CancellationToken ct)
    {
        var lead = await repo.GetAsync(req.Id, ct);
        if (lead is null)
            return Result.Failure<LeadDto>(Error.NotFound($"Lead {req.Id} not found."));

        var status = LeadMapping.ParseStatus(req.Status);
        if (status == LeadStatus.Converted)
            return Result.Failure<LeadDto>(Error.Validation("Use the convert endpoint to convert a lead."));

        try
        {
            lead.SetStatus(status, tenant.UserName);
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<LeadDto>(Error.Conflict(ex.Message));
        }

        await uow.SaveChangesAsync(ct);
        return lead.ToDto();
    }
}

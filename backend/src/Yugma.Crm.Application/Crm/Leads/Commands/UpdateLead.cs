using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.Crm;
using Yugma.Crm.Domain.Hr.ValueObjects;
using Yugma.Crm.Shared.Results;
using FluentValidation;
using MediatR;

namespace Yugma.Crm.Application.Crm.Leads.Commands;

public sealed record UpdateLeadCommand(
    Guid Id,
    string FullName,
    string Company,
    string Email,
    string Phone,
    string Source,
    int Score,
    string Owner) : IRequest<Result<LeadDto>>;

public sealed class UpdateLeadValidator : AbstractValidator<UpdateLeadCommand>
{
    public UpdateLeadValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Company).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Phone).NotEmpty().MinimumLength(7);
        RuleFor(x => x.Owner).NotEmpty();
        RuleFor(x => x.Score).InclusiveBetween(0, 100);
    }
}

internal sealed class UpdateLeadHandler(
    ILeadRepository repo,
    IUnitOfWork uow,
    ITenantContext tenant)
    : IRequestHandler<UpdateLeadCommand, Result<LeadDto>>
{
    public async Task<Result<LeadDto>> Handle(UpdateLeadCommand req, CancellationToken ct)
    {
        var lead = await repo.GetAsync(req.Id, ct);
        if (lead is null)
            return Result.Failure<LeadDto>(Error.NotFound($"Lead {req.Id} not found."));

        lead.UpdateDetails(
            PersonName.Create(req.FullName),
            req.Company,
            Email.Create(req.Email),
            PhoneNumber.Create(req.Phone),
            LeadMapping.ParseSource(req.Source),
            req.Owner,
            tenant.UserName);
        lead.Rescore(req.Score, tenant.UserName);

        await uow.SaveChangesAsync(ct);
        return lead.ToDto();
    }
}

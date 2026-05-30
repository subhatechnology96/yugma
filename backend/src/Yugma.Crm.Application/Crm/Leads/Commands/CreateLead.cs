using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.Crm;
using Yugma.Crm.Domain.Hr.ValueObjects;
using Yugma.Crm.Shared.Results;
using FluentValidation;
using MediatR;

namespace Yugma.Crm.Application.Crm.Leads.Commands;

public sealed record CreateLeadCommand(
    string FullName,
    string Company,
    string Email,
    string Phone,
    string Source,
    int Score,
    string Owner) : IRequest<Result<LeadDto>>;

public sealed class CreateLeadValidator : AbstractValidator<CreateLeadCommand>
{
    public CreateLeadValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Company).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Phone).NotEmpty().MinimumLength(7);
        RuleFor(x => x.Owner).NotEmpty();
        RuleFor(x => x.Score).InclusiveBetween(0, 100);
    }
}

internal sealed class CreateLeadHandler(
    ILeadRepository repo,
    IUnitOfWork uow,
    ITenantContext tenant)
    : IRequestHandler<CreateLeadCommand, Result<LeadDto>>
{
    public async Task<Result<LeadDto>> Handle(CreateLeadCommand req, CancellationToken ct)
    {
        var code = await repo.NextCodeAsync(ct);
        var lead = Lead.Create(
            tenant.TenantId, code,
            PersonName.Create(req.FullName),
            req.Company,
            Email.Create(req.Email),
            PhoneNumber.Create(req.Phone),
            LeadMapping.ParseSource(req.Source),
            req.Score,
            req.Owner,
            tenant.UserName);

        await repo.AddAsync(lead, ct);
        await uow.SaveChangesAsync(ct);
        return lead.ToDto();
    }
}

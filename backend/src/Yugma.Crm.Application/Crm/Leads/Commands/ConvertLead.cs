using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.Crm;
using Yugma.Crm.Domain.Hr.ValueObjects;
using Yugma.Crm.Shared.Results;
using FluentValidation;
using MediatR;

namespace Yugma.Crm.Application.Crm.Leads.Commands;

public sealed record ConvertLeadResult(Guid LeadId, Guid AccountId, Guid ContactId, Guid DealId, string DealCode);

public sealed record ConvertLeadCommand(
    Guid LeadId,
    string? DealName,
    decimal DealValue,
    DateOnly? CloseDate,
    Guid? StageId) : IRequest<Result<ConvertLeadResult>>;

public sealed class ConvertLeadValidator : AbstractValidator<ConvertLeadCommand>
{
    public ConvertLeadValidator()
    {
        RuleFor(x => x.LeadId).NotEmpty();
        RuleFor(x => x.DealValue).GreaterThanOrEqualTo(0);
    }
}

// Lead → Account + Contact + Deal. All four mutations are committed in a single
// SaveChangesAsync, which EF Core wraps in one transaction — so conversion is atomic.
internal sealed class ConvertLeadHandler(
    ILeadRepository leads,
    IAccountRepository accounts,
    IContactRepository contacts,
    IDealRepository deals,
    IDealStageRepository stages,
    IUnitOfWork uow,
    ITenantContext tenant)
    : IRequestHandler<ConvertLeadCommand, Result<ConvertLeadResult>>
{
    public async Task<Result<ConvertLeadResult>> Handle(ConvertLeadCommand req, CancellationToken ct)
    {
        var lead = await leads.GetAsync(req.LeadId, ct);
        if (lead is null)
            return Result.Failure<ConvertLeadResult>(Error.NotFound($"Lead {req.LeadId} not found."));
        if (lead.Status == LeadStatus.Converted)
            return Result.Failure<ConvertLeadResult>(Error.Conflict("Lead has already been converted."));

        Guid stageId;
        int probability;
        if (req.StageId is { } sid)
        {
            var stage = await stages.GetAsync(sid, ct);
            if (stage is null)
                return Result.Failure<ConvertLeadResult>(Error.Validation($"Stage {sid} does not exist."));
            stageId = stage.Id;
            probability = stage.Probability;
        }
        else
        {
            var first = (await stages.ListAsync(ct))
                .Where(s => !s.IsWon && !s.IsLost)
                .OrderBy(s => s.Order)
                .FirstOrDefault();
            if (first is null)
                return Result.Failure<ConvertLeadResult>(Error.Validation("No pipeline stage is configured."));
            stageId = first.Id;
            probability = first.Probability;
        }

        var owner = lead.Owner;

        var account = Account.Create(
            tenant.TenantId, lead.Company, industry: null, website: null, phone: lead.Phone.Value,
            size: null, annualRevenue: 0m, owner: owner, status: AccountStatus.Prospect, createdBy: tenant.UserName);

        var contact = Contact.Create(
            tenant.TenantId, lead.Name, lead.Email, lead.Phone, title: null,
            accountId: account.Id, owner: owner, isPrimary: true, createdBy: tenant.UserName);

        var dealName = string.IsNullOrWhiteSpace(req.DealName) ? $"{lead.Company} — New opportunity" : req.DealName!.Trim();
        var closeDate = req.CloseDate ?? DateOnly.FromDateTime(DateTime.UtcNow).AddDays(30);
        var code = await deals.NextCodeAsync(ct);

        var deal = Deal.Create(
            tenant.TenantId, code, dealName, account.Id, contact.Id,
            req.DealValue, stageId, probability, closeDate, owner, tenant.UserName);

        lead.MarkConverted(account.Id, contact.Id, deal.Id, tenant.UserName);

        await accounts.AddAsync(account, ct);
        await contacts.AddAsync(contact, ct);
        await deals.AddAsync(deal, ct);

        // Single commit → atomic across all four aggregates.
        await uow.SaveChangesAsync(ct);

        return new ConvertLeadResult(lead.Id, account.Id, contact.Id, deal.Id, deal.Code);
    }
}

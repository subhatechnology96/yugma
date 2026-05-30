using Yugma.Crm.Application.Crm.Common;
using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.Crm;
using Yugma.Crm.Shared.Results;
using FluentValidation;
using MediatR;

namespace Yugma.Crm.Application.Crm.Activities;

public sealed record CreateActivityCommand(
    string Type,
    string Subject,
    DateTime DueAt,
    string RelatedToType,
    Guid RelatedToId,
    string Owner,
    DateTime? ReminderAt) : IRequest<Result<ActivityDto>>;

public sealed class CreateActivityValidator : AbstractValidator<CreateActivityCommand>
{
    public CreateActivityValidator()
    {
        RuleFor(x => x.Subject).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Owner).NotEmpty();
        RuleFor(x => x.RelatedToId).NotEmpty();
    }
}

internal sealed class CreateActivityHandler(IActivityRepository repo, IUnitOfWork uow, ITenantContext tenant)
    : IRequestHandler<CreateActivityCommand, Result<ActivityDto>>
{
    public async Task<Result<ActivityDto>> Handle(CreateActivityCommand req, CancellationToken ct)
    {
        var activity = Activity.Create(
            tenant.TenantId, CrmWire.ParseActivityType(req.Type), req.Subject, req.DueAt,
            CrmWire.ParseEntityType(req.RelatedToType), req.RelatedToId, req.Owner, req.ReminderAt, tenant.UserName);
        await repo.AddAsync(activity, ct);
        await uow.SaveChangesAsync(ct);
        return activity.ToDto();
    }
}

public sealed record MarkActivityDoneCommand(Guid Id) : IRequest<Result<ActivityDto>>;

internal sealed class MarkActivityDoneHandler(IActivityRepository repo, IUnitOfWork uow, ITenantContext tenant)
    : IRequestHandler<MarkActivityDoneCommand, Result<ActivityDto>>
{
    public async Task<Result<ActivityDto>> Handle(MarkActivityDoneCommand req, CancellationToken ct)
    {
        var activity = await repo.GetAsync(req.Id, ct);
        if (activity is null)
            return Result.Failure<ActivityDto>(Error.NotFound($"Activity {req.Id} not found."));
        activity.MarkDone(tenant.UserName);
        await uow.SaveChangesAsync(ct);
        return activity.ToDto();
    }
}

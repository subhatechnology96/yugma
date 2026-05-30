using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.Crm;
using Yugma.Crm.Domain.Hr.ValueObjects;
using Yugma.Crm.Shared.Results;
using FluentValidation;
using MediatR;

namespace Yugma.Crm.Application.Crm.Contacts;

public sealed record CreateContactCommand(
    string FullName,
    string Email,
    string Phone,
    string? Title,
    Guid AccountId,
    string Owner,
    bool IsPrimary) : IRequest<Result<ContactDto>>;

public sealed class CreateContactValidator : AbstractValidator<CreateContactCommand>
{
    public CreateContactValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Phone).NotEmpty().MinimumLength(7);
        RuleFor(x => x.AccountId).NotEmpty();
        RuleFor(x => x.Owner).NotEmpty();
    }
}

internal sealed class CreateContactHandler(IContactRepository repo, IAccountRepository accounts, IUnitOfWork uow, ITenantContext tenant)
    : IRequestHandler<CreateContactCommand, Result<ContactDto>>
{
    public async Task<Result<ContactDto>> Handle(CreateContactCommand req, CancellationToken ct)
    {
        var account = await accounts.GetAsync(req.AccountId, ct);
        if (account is null)
            return Result.Failure<ContactDto>(Error.Validation($"Account {req.AccountId} does not exist."));

        var contact = Contact.Create(
            tenant.TenantId, PersonName.Create(req.FullName), Email.Create(req.Email), PhoneNumber.Create(req.Phone),
            req.Title, req.AccountId, req.Owner, req.IsPrimary, tenant.UserName);
        await repo.AddAsync(contact, ct);
        await uow.SaveChangesAsync(ct);
        return contact.ToDto(account.Name);
    }
}

public sealed record UpdateContactCommand(
    Guid Id,
    string FullName,
    string Email,
    string Phone,
    string? Title,
    string Owner,
    bool IsPrimary) : IRequest<Result<ContactDto>>;

public sealed class UpdateContactValidator : AbstractValidator<UpdateContactCommand>
{
    public UpdateContactValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Phone).NotEmpty().MinimumLength(7);
        RuleFor(x => x.Owner).NotEmpty();
    }
}

internal sealed class UpdateContactHandler(IContactRepository repo, IAccountRepository accounts, IUnitOfWork uow, ITenantContext tenant)
    : IRequestHandler<UpdateContactCommand, Result<ContactDto>>
{
    public async Task<Result<ContactDto>> Handle(UpdateContactCommand req, CancellationToken ct)
    {
        var contact = await repo.GetAsync(req.Id, ct);
        if (contact is null)
            return Result.Failure<ContactDto>(Error.NotFound($"Contact {req.Id} not found."));

        contact.UpdateDetails(PersonName.Create(req.FullName), Email.Create(req.Email), PhoneNumber.Create(req.Phone),
            req.Title, req.Owner, req.IsPrimary, tenant.UserName);
        await uow.SaveChangesAsync(ct);
        var account = await accounts.GetAsync(contact.AccountId, ct);
        return contact.ToDto(account?.Name ?? "—");
    }
}

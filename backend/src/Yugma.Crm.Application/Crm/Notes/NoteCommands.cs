using Yugma.Crm.Application.Crm.Common;
using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.Crm;
using Yugma.Crm.Shared.Results;
using FluentValidation;
using MediatR;

namespace Yugma.Crm.Application.Crm.Notes;

public sealed record CreateNoteCommand(
    string Body,
    string RelatedToType,
    Guid RelatedToId,
    string Author) : IRequest<Result<NoteDto>>;

public sealed class CreateNoteValidator : AbstractValidator<CreateNoteCommand>
{
    public CreateNoteValidator()
    {
        RuleFor(x => x.Body).NotEmpty().MaximumLength(4000);
        RuleFor(x => x.Author).NotEmpty();
        RuleFor(x => x.RelatedToId).NotEmpty();
    }
}

internal sealed class CreateNoteHandler(INoteRepository repo, IUnitOfWork uow, ITenantContext tenant)
    : IRequestHandler<CreateNoteCommand, Result<NoteDto>>
{
    public async Task<Result<NoteDto>> Handle(CreateNoteCommand req, CancellationToken ct)
    {
        var note = Note.Create(
            tenant.TenantId, req.Body, CrmWire.ParseEntityType(req.RelatedToType), req.RelatedToId, req.Author, tenant.UserName);
        await repo.AddAsync(note, ct);
        await uow.SaveChangesAsync(ct);
        return note.ToDto();
    }
}

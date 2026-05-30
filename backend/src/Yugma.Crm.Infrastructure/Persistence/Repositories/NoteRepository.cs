using Yugma.Crm.Domain.Crm;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Infrastructure.Persistence.Repositories;

internal sealed class NoteRepository(YugmaDbContext db) : INoteRepository
{
    public Task<Note?> GetAsync(Guid id, CancellationToken ct) =>
        db.Notes.FirstOrDefaultAsync(e => e.Id == id, ct);

    public async Task<IReadOnlyList<Note>> ListByRelatedAsync(CrmEntityType type, Guid relatedId, CancellationToken ct) =>
        await db.Notes.AsNoTracking()
            .Where(e => e.RelatedToType == type && e.RelatedToId == relatedId)
            .OrderByDescending(e => e.CreatedAt).ToListAsync(ct);

    public async Task AddAsync(Note note, CancellationToken ct) => await db.Notes.AddAsync(note, ct);

    public void Remove(Note note) => db.Notes.Remove(note);
}

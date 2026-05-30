namespace Yugma.Crm.Domain.Crm;

public interface INoteRepository
{
    Task<Note?> GetAsync(Guid id, CancellationToken ct);
    Task<IReadOnlyList<Note>> ListByRelatedAsync(CrmEntityType type, Guid relatedId, CancellationToken ct);
    Task AddAsync(Note note, CancellationToken ct);
    void Remove(Note note);
}

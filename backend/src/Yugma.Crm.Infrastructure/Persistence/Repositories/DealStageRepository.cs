using Yugma.Crm.Domain.Crm;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Infrastructure.Persistence.Repositories;

internal sealed class DealStageRepository(YugmaDbContext db) : IDealStageRepository
{
    public async Task<IReadOnlyList<DealStage>> ListAsync(CancellationToken ct) =>
        await db.DealStages.AsNoTracking().OrderBy(s => s.Order).ToListAsync(ct);

    public Task<DealStage?> GetAsync(Guid id, CancellationToken ct) =>
        db.DealStages.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id, ct);
}

namespace Yugma.Crm.Domain.Crm;

public interface IDealStageRepository
{
    Task<IReadOnlyList<DealStage>> ListAsync(CancellationToken ct);
    Task<DealStage?> GetAsync(Guid id, CancellationToken ct);
}

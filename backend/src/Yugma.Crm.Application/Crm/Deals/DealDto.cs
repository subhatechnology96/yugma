namespace Yugma.Crm.Application.Crm.Deals;

public sealed record DealDto(
    Guid Id,
    string Code,
    string Name,
    Guid AccountId,
    string AccountName,
    Guid? ContactId,
    string? ContactName,
    decimal Value,
    Guid StageId,
    string StageName,
    string Status,
    int Probability,
    DateOnly CloseDate,
    string Owner,
    DateTime? LastActivityAt,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public sealed record PipelineStageDto(
    Guid StageId,
    string Name,
    int Order,
    int Probability,
    bool IsWon,
    bool IsLost,
    decimal TotalValue,
    int Count,
    IReadOnlyList<DealDto> Deals);

public sealed record PipelineDto(
    IReadOnlyList<PipelineStageDto> Stages,
    decimal TotalOpenValue,
    decimal WeightedValue);

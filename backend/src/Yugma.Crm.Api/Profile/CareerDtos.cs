namespace Yugma.Crm.Api.Profile;

public sealed record CareerDto(
    CareerSummaryDto Summary,
    IReadOnlyList<RoleStintDto> RoleHistory,
    IReadOnlyList<ManagerStintDto> Managers,
    IReadOnlyList<AchievementDto> Achievements,
    IReadOnlyList<CareerEventDto> Timeline,
    IReadOnlyList<ProjectDto> Projects);

public sealed record CareerSummaryDto(
    string Name,
    string CurrentRole,
    string Department,
    string? AvatarUrl,
    DateOnly JoinedAt,
    double TenureYears,
    int TotalProjects,
    int CompletedProjects,
    int OngoingProjects,
    int Promotions,
    int Awards,
    double AvgProjectRating,
    IReadOnlyList<string> CoreSkills);

public sealed record RoleStintDto(
    string Title,
    string Level,
    DateOnly From,
    DateOnly? To,
    string Manager,
    double Years);

public sealed record ManagerStintDto(
    string Name,
    string Relationship,
    DateOnly From,
    DateOnly? To);

public sealed record AchievementDto(
    DateOnly Date,
    string Title,
    string Description,
    string Category);

public sealed record CareerEventDto(
    DateOnly Date,
    string Type,
    string Title,
    string Detail,
    string Icon);

public sealed record ProjectDto(
    string Id,
    bool IsCustom,
    string Name,
    string Domain,
    string Role,
    string Manager,
    DateOnly StartDate,
    DateOnly? EndDate,
    string Status,
    int Rating,
    int DurationMonths,
    int TeamSize,
    IReadOnlyList<string> Responsibilities,
    string Outcome,
    string Feedback,
    IReadOnlyList<string> Skills,
    IReadOnlyList<string> Achievements);

namespace Yugma.Crm.Api.Performance;

// ---------- org summary (KPIs + distribution + year/quarter trend) ----------
public sealed record PerfSummaryDto(
    int Year,
    double AvgRating,
    int TopPerformers,
    int OnPip,
    int ReviewsDue,
    int Employees,
    IReadOnlyList<int> Distribution,        // index 0..4 → ratings 1..5
    IReadOnlyList<QuarterAvgDto> ByQuarter); // org avg rating per quarter of the year

public sealed record QuarterAvgDto(int Quarter, string Label, double Avg, string Status);

// ---------- per-employee tracker row ----------
public sealed record PerfTrackerRowDto(
    Guid EmployeeId,
    string Name,
    string Designation,
    string Department,
    string? AvatarUrl,
    double CurrentRating,
    double PrevRating,
    double Delta,
    IReadOnlyList<double> Trend,            // last 4 quarters
    string LatestLabel,
    string Status,
    bool OnPip,
    string NineBox);

// ---------- per-employee detail (year-wise + quarter-wise) ----------
public sealed record PerfEmployeeDto(
    Guid EmployeeId,
    string Name,
    string Designation,
    string Department,
    string? AvatarUrl,
    string Manager,
    double CurrentRating,
    double Delta,
    string NineBox,
    IReadOnlyList<PerfYearDto> Years);

public sealed record PerfYearDto(
    int Year,
    double Avg,
    int Reviews,
    IReadOnlyList<PerfQuarterDto> Quarters);

public sealed record PerfQuarterDto(
    int Quarter,
    string Label,
    double Rating,
    int GoalProgress,
    string Status,
    string Reviewer,
    string NineBox,
    int OneOnOnes,
    IReadOnlyList<CompetencyDto> Competencies,
    string Summary,
    bool IsManual);

public sealed record CompetencyDto(string Name, int Score);

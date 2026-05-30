using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Hr.Performance;

/// <summary>
/// A manual performance review entered by an Admin / HR / manager for an employee's quarter.
/// When present it overrides the system-generated calibration for that quarter.
/// </summary>
public sealed class PerformanceReview : Entity<Guid>, IAggregateRoot
{
    public Guid EmployeeId { get; private set; }
    public int Year { get; private set; }
    public int Quarter { get; private set; }
    public decimal Rating { get; private set; }
    public int GoalProgress { get; private set; }
    public string Status { get; private set; } = default!;
    public string? Reviewer { get; private set; }
    public string? Summary { get; private set; }
    public string Competencies { get; private set; } = default!; // CSV of 5 scores (Delivery,Collaboration,Ownership,Innovation,Communication)

    private PerformanceReview() { } // EF

    public static PerformanceReview Create(Guid tenantId, Guid employeeId, int year, int quarter,
        decimal rating, int goalProgress, string status, string? reviewer, string? summary, string competencies, string? by)
        => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EmployeeId = employeeId,
            Year = year,
            Quarter = quarter,
            Rating = rating,
            GoalProgress = goalProgress,
            Status = status,
            Reviewer = reviewer,
            Summary = summary,
            Competencies = competencies,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = by
        };

    public void Update(decimal rating, int goalProgress, string status, string? reviewer, string? summary, string competencies, string? by)
    {
        Rating = rating;
        GoalProgress = goalProgress;
        Status = status;
        Reviewer = reviewer;
        Summary = summary;
        Competencies = competencies;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = by;
    }
}

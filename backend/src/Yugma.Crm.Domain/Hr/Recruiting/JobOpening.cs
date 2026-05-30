using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Hr.Recruiting;

public enum JobStatus { Open, OnHold, Closed }

public sealed class JobOpening : Entity<Guid>, IAggregateRoot
{
    public string Title { get; set; } = default!;
    public string Department { get; set; } = default!;
    public string Location { get; set; } = default!;
    public string EmploymentType { get; set; } = default!;
    public int Openings { get; set; }
    public JobStatus Status { get; set; }
    public string? HiringManager { get; set; }
    public decimal BudgetCtcLakhs { get; set; }
    public DateOnly PostedAt { get; set; }
    public string Priority { get; set; } = "Medium"; // High | Medium | Low

    public static JobOpening Create(
        Guid tenantId, string title, string department, string location, string employmentType,
        int openings, JobStatus status, string? hiringManager, decimal budgetCtcLakhs, DateOnly postedAt, string priority)
        => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Title = title,
            Department = department,
            Location = location,
            EmploymentType = employmentType,
            Openings = openings,
            Status = status,
            HiringManager = hiringManager,
            BudgetCtcLakhs = budgetCtcLakhs,
            PostedAt = postedAt,
            Priority = priority,
            CreatedAt = DateTime.UtcNow
        };
}

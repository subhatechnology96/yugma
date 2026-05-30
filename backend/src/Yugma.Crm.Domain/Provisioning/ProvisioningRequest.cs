using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Provisioning;

public sealed class ProvisioningRequest : Entity<Guid>, IAggregateRoot
{
    public Guid EmployeeId { get; set; }
    public string EmployeeName { get; set; } = default!;
    public string Email { get; set; } = default!;
    public string Department { get; set; } = default!;
    public string Designation { get; set; } = default!;
    public string Location { get; set; } = default!;
    /// <summary>pending | in_progress | completed | rejected</summary>
    public string Status { get; set; } = "pending";
    public DateTime RequestedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public string? AssignedTo { get; set; }
    public string? Notes { get; set; }

    public static ProvisioningRequest Open(
        Guid tenantId,
        Guid employeeId,
        string employeeName,
        string email,
        string department,
        string designation,
        string location)
        => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EmployeeId = employeeId,
            EmployeeName = employeeName,
            Email = email,
            Department = department,
            Designation = designation,
            Location = location,
            Status = "pending",
            RequestedAtUtc = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };
}

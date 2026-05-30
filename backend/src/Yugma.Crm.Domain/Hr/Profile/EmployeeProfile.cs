using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Hr.Profile;

/// <summary>
/// Persisted personal / HR-profile details for an employee (one row each). Replaces the values that the
/// profile-overview factory used to fabricate on every request, so they are real, stable and editable.
/// </summary>
public sealed class EmployeeProfile : Entity<Guid>, IAggregateRoot
{
    public Guid EmployeeId { get; set; }
    public string PersonalEmail { get; set; } = default!;
    public DateOnly DateOfBirth { get; set; }
    public string Worksite { get; set; } = default!;        // On-site / Hybrid / Remote
    public string Grade { get; set; } = default!;           // L2..M2
    public string BloodGroup { get; set; } = default!;
    public string MaritalStatus { get; set; } = default!;
    public string Address { get; set; } = default!;
    public string EmergencyName { get; set; } = default!;
    public string EmergencyRelation { get; set; } = default!;
    public string EmergencyPhone { get; set; } = default!;
    public string PanMasked { get; set; } = default!;
    public string AadhaarMasked { get; set; } = default!;
    public string BankName { get; set; } = default!;
    public string BankAccountMasked { get; set; } = default!;
    public string Uan { get; set; } = default!;
    public string About { get; set; } = default!;

    public static EmployeeProfile Create(Guid tenantId, Guid employeeId) =>
        new() { Id = Guid.NewGuid(), TenantId = tenantId, EmployeeId = employeeId, CreatedAt = DateTime.UtcNow };
}

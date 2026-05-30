namespace Yugma.Crm.Domain.Provisioning;

/// <summary>
/// Side-effect hook fired when an employee is created. Implementations open a provisioning
/// ticket for the IT/Network team and notify them so a new user account can be set up.
/// </summary>
public interface IEmployeeProvisioningHook
{
    Task OnEmployeeCreatedAsync(
        Guid employeeId,
        string employeeName,
        string email,
        string department,
        string designation,
        string location,
        CancellationToken ct);
}

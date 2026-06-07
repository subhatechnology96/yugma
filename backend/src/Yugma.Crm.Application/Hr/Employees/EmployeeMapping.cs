using Yugma.Crm.Domain.Hr;

namespace Yugma.Crm.Application.Hr.Employees;

internal static class EmployeeMapping
{
    public static EmployeeDto ToDto(this Employee e) => new(
        e.Id,
        e.Code,
        e.Name.Full,
        e.Email.Value,
        e.Phone.Value,
        e.Department,
        e.Designation,
        e.Location,
        e.Manager,
        e.EmploymentType switch
        {
            EmploymentType.FullTime => "Full-time",
            EmploymentType.PartTime => "Part-time",
            EmploymentType.Contract => "Contract",
            _ => "Intern"
        },
        e.Status switch
        {
            EmployeeStatus.Active => "active",
            EmployeeStatus.OnLeave => "on-leave",
            _ => "inactive"
        },
        e.JoinedAt,
        e.CtcLakhs,
        e.Performance,
        e.Skills,
        e.CreatedAt,
        e.UpdatedAt,
        e.AvatarUrl,
        e.HrPartnerId,
        e.HrPartner);
}

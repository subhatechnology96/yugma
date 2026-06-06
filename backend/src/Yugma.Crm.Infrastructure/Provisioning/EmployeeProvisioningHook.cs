using Yugma.Crm.Domain.Notifications;
using Yugma.Crm.Domain.Provisioning;
using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.Extensions.Logging;

namespace Yugma.Crm.Infrastructure.Provisioning;

internal sealed class EmployeeProvisioningHook(
    YugmaDbContext db,
    ILogger<EmployeeProvisioningHook> logger) : IEmployeeProvisioningHook
{
    public async Task OnEmployeeCreatedAsync(
        Guid employeeId,
        string employeeName,
        string email,
        string department,
        string designation,
        string location,
        CancellationToken ct)
    {
        // The CreateEmployee handler calls UoW.SaveChanges at the end; we just attach more changes.
        // Tenant filter is enforced via the DbContext's SaveChangesAsync override (sets TenantId if empty).
        var tenantId = db.ChangeTracker.Entries<Domain.Common.Entity<Guid>>()
            .Select(e => e.Entity.TenantId)
            .FirstOrDefault();

        var ticket = ProvisioningRequest.Open(
            tenantId,
            employeeId,
            employeeName,
            email,
            department,
            designation,
            location);
        await db.ProvisioningRequests.AddAsync(ticket, ct);

        var notice = AppNotification.Create(
            tenantId,
            title: "New user provisioning required",
            message: $"{employeeName} ({email}) joined {department} as {designation}. Create network/AD account.",
            kind: NotificationKind.Warn,
            createdAt: DateTime.UtcNow,
            read: false,
            link: "/it/provisioning",
            audience: "admin"); // IT/admins act on provisioning, not the new joiner
        await db.Notifications.AddAsync(notice, ct);

        logger.LogInformation(
            "Provisioning ticket {TicketId} opened for {Employee} ({Email})",
            ticket.Id, employeeName, email);
    }
}

using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.Agents;
using Yugma.Crm.Domain.Audit;
using Yugma.Crm.Domain.Common;
using Yugma.Crm.Domain.Crm;
using Yugma.Crm.Domain.Hr;
using Yugma.Crm.Domain.Hr.Attendance;
using Yugma.Crm.Domain.Hr.Career;
using Yugma.Crm.Domain.Hr.Documents;
using Yugma.Crm.Domain.Hr.Leave;
using Yugma.Crm.Domain.Hr.Org;
using Yugma.Crm.Domain.Hr.Payroll;
using Yugma.Crm.Domain.Hr.Profile;
using Yugma.Crm.Domain.Hr.Tax;
using Yugma.Crm.Domain.Hr.Performance;
using Yugma.Crm.Domain.Hr.Recruiting;
using Yugma.Crm.Domain.Identity;
using Yugma.Crm.Domain.Notifications;
using Yugma.Crm.Domain.Provisioning;
using Yugma.Crm.Domain.Reference;
using Yugma.Crm.Domain.Subscriptions;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Infrastructure.Persistence;

public sealed class YugmaDbContext(DbContextOptions<YugmaDbContext> options, ITenantContext tenant)
    : DbContext(options), IUnitOfWork
{
    private readonly ITenantContext _tenant = tenant;

    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<LeaveRequest> LeaveRequests => Set<LeaveRequest>();
    public DbSet<AttendanceRecord> AttendanceRecords => Set<AttendanceRecord>();
    public DbSet<AttendanceOverride> AttendanceOverrides => Set<AttendanceOverride>();
    public DbSet<AttendanceCorrection> AttendanceCorrections => Set<AttendanceCorrection>();
    public DbSet<PerformanceReview> PerformanceReviews => Set<PerformanceReview>();
    public DbSet<ReportingAssignment> ReportingAssignments => Set<ReportingAssignment>();
    public DbSet<PayrollRun> PayrollRuns => Set<PayrollRun>();
    public DbSet<Payslip> Payslips => Set<Payslip>();
    public DbSet<Candidate> Candidates => Set<Candidate>();
    public DbSet<JobOpening> JobOpenings => Set<JobOpening>();
    public DbSet<Yugma.Crm.Domain.Hr.Referrals.EmployeeReferral> EmployeeReferrals => Set<Yugma.Crm.Domain.Hr.Referrals.EmployeeReferral>();
    public DbSet<Yugma.Crm.Domain.Hr.Fleet.Vehicle> Vehicles => Set<Yugma.Crm.Domain.Hr.Fleet.Vehicle>();
    public DbSet<EmployeeDocument> EmployeeDocuments => Set<EmployeeDocument>();
    public DbSet<EmployeeProject> EmployeeProjects => Set<EmployeeProject>();
    public DbSet<EmployeeProfile> EmployeeProfiles => Set<EmployeeProfile>();
    public DbSet<InvestmentDeclaration> InvestmentDeclarations => Set<InvestmentDeclaration>();
    public DbSet<Invoice> Invoices => Set<Invoice>();

    // CRM module
    public DbSet<Lead> Leads => Set<Lead>();
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<Contact> Contacts => Set<Contact>();
    public DbSet<Deal> Deals => Set<Deal>();
    public DbSet<DealStage> DealStages => Set<DealStage>();
    public DbSet<Activity> Activities => Set<Activity>();
    public DbSet<Note> Notes => Set<Note>();

    // Services module
    public DbSet<Yugma.Crm.Domain.Services.ServiceOrder> ServiceOrders => Set<Yugma.Crm.Domain.Services.ServiceOrder>();
    public DbSet<Yugma.Crm.Domain.Services.ServiceTimesheet> ServiceTimesheets => Set<Yugma.Crm.Domain.Services.ServiceTimesheet>();

    // Finance module
    public DbSet<Yugma.Crm.Domain.Finance.FinanceDocument> FinanceDocuments => Set<Yugma.Crm.Domain.Finance.FinanceDocument>();
    public DbSet<Yugma.Crm.Domain.Finance.Expense> Expenses => Set<Yugma.Crm.Domain.Finance.Expense>();
    public DbSet<Yugma.Crm.Domain.Finance.BankAccount> BankAccounts => Set<Yugma.Crm.Domain.Finance.BankAccount>();
    public DbSet<Yugma.Crm.Domain.Finance.BankTransaction> BankTransactions => Set<Yugma.Crm.Domain.Finance.BankTransaction>();
    public DbSet<Yugma.Crm.Domain.Finance.FinanceFile> FinanceFiles => Set<Yugma.Crm.Domain.Finance.FinanceFile>();

    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<AppUser> AppUsers => Set<AppUser>();
    public DbSet<AppNotification> Notifications => Set<AppNotification>();
    public DbSet<ModuleSubscription> ModuleSubscriptions => Set<ModuleSubscription>();
    public DbSet<ProvisioningRequest> ProvisioningRequests => Set<ProvisioningRequest>();
    public DbSet<HrAgent> HrAgents => Set<HrAgent>();
    public DbSet<HrAgentRun> HrAgentRuns => Set<HrAgentRun>();

    // Global reference/lookup catalogs (not tenant-scoped)
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<RoleDefinition> RoleDefinitions => Set<RoleDefinition>();
    public DbSet<HierarchyLevel> HierarchyLevels => Set<HierarchyLevel>();
    public DbSet<LeaveTypeConfig> LeaveTypes => Set<LeaveTypeConfig>();
    public DbSet<PayrollSetting> PayrollSettings => Set<PayrollSetting>();
    public DbSet<TaxSlab> TaxSlabs => Set<TaxSlab>();
    public DbSet<CompetencyDefinition> Competencies => Set<CompetencyDefinition>();
    public DbSet<Holiday> Holidays => Set<Holiday>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.HasDefaultSchema("yugma");
        mb.ApplyConfigurationsFromAssembly(typeof(YugmaDbContext).Assembly);

        foreach (var entityType in mb.Model.GetEntityTypes())
        {
            if (typeof(Entity<Guid>).IsAssignableFrom(entityType.ClrType))
            {
                // Global filter: every entity is scoped to the tenant from the current request context.
                var method = typeof(YugmaDbContext)
                    .GetMethod(nameof(SetTenantFilter), System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static)!
                    .MakeGenericMethod(entityType.ClrType);
                method.Invoke(null, new object[] { mb, _tenant });
            }
        }

        base.OnModelCreating(mb);
    }

    private static void SetTenantFilter<T>(ModelBuilder mb, ITenantContext tenant) where T : Entity<Guid>
        => mb.Entity<T>().HasQueryFilter(e => e.TenantId == tenant.TenantId);

    public override Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        foreach (var entry in ChangeTracker.Entries<Entity<Guid>>())
        {
            if (entry.State == EntityState.Added && entry.Entity.TenantId == Guid.Empty)
            {
                typeof(Entity<Guid>).GetProperty(nameof(Entity<Guid>.TenantId))!.SetValue(entry.Entity, _tenant.TenantId);
            }
        }
        return base.SaveChangesAsync(ct);
    }
}

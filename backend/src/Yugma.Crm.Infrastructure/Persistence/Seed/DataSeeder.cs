using Yugma.Crm.Domain.Agents;
using Yugma.Crm.Domain.Audit;
using Yugma.Crm.Domain.Crm;
using Yugma.Crm.Domain.Finance;
using Yugma.Crm.Domain.Hr;
using Yugma.Crm.Domain.Hr.Attendance;
using Yugma.Crm.Domain.Hr.Fleet;
using Yugma.Crm.Domain.Hr.Referrals;
using Yugma.Crm.Domain.Hr.Documents;
using Yugma.Crm.Domain.Hr.Leave;
using Yugma.Crm.Domain.Hr.Payroll;
using Yugma.Crm.Domain.Hr.Recruiting;
using Yugma.Crm.Domain.Hr.ValueObjects;
using Yugma.Crm.Domain.Identity;
using Yugma.Crm.Domain.Notifications;
using Yugma.Crm.Domain.Reference;
using Yugma.Crm.Domain.Sales;
using Yugma.Crm.Domain.Services;
using Yugma.Crm.Domain.SupplyChain;
using Yugma.Crm.Domain.Subscriptions;
using Yugma.Crm.Infrastructure.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Yugma.Crm.Infrastructure.Persistence.Seed;

public static class DataSeeder
{
    // The HttpTenantContext returns this Guid in dev (no HTTP context).
    private static readonly Guid DemoTenant = Guid.Parse("00000000-0000-0000-0000-00000000ace1");

    public static async Task SeedAsync(IServiceProvider services, CancellationToken ct = default)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<YugmaDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<YugmaDbContext>>();

        await db.Database.MigrateAsync(ct);

        await SeedReferenceAsync(db, ct);
        await SeedEmployeesAsync(db, ct);
        await SeedHierarchyAsync(db, ct);
        await SeedPersonaEmployeesAsync(db, ct);
        await SeedLeaveAsync(db, ct);
        await SeedAttendanceAsync(db, ct);
        // After leave/attendance so the team's pending requests aren't wiped by those re-seed guards.
        await SeedMayaTeamAsync(db, ct);
        await SeedHrDepartmentAsync(db, ct);
        await AssignHrPartnersAsync(db, ct);
        await SeedPayrollAsync(db, ct);
        await SeedCandidatesAsync(db, ct);
        await SeedJobOpeningsAsync(db, ct);
        await SeedHrModulesAsync(db, ct);
        await SeedEmployeeDocumentsAsync(db, ct);
        await SeedInvoicesAsync(db, ct);
        await SeedServicesAsync(db, ct);
        await SeedSalesAsync(db, ct);
        await SeedSupplyChainAsync(db, ct);
        await SeedFinanceAsync(db, ct);
        await SeedAuditLogsAsync(db, ct);
        await SeedAppUsersAsync(db, ct);
        await SeedNotificationsAsync(db, ct);
        await SeedPersonalNotificationsAsync(db, ct);
        await SeedSubscriptionsAsync(db, ct);
        await SeedAgentsAsync(db, ct);

        logger.LogInformation("Data seed complete for tenant {Tenant}", DemoTenant);
    }

    // IgnoreQueryFilters needed because tenant filter is wired to ITenantContext which has no HttpContext during startup.
    /// <summary>
    /// Seeds the global reference/lookup catalogs (tenant, roles, hierarchy levels, leave types) so the
    /// controllers read these values from Postgres instead of hardcoded C# arrays. Each table is seeded
    /// once (idempotent).
    /// </summary>
    private static async Task SeedReferenceAsync(YugmaDbContext db, CancellationToken ct)
    {
        if (!await db.Tenants.AnyAsync(t => t.Id == DemoTenant, ct))
            db.Tenants.Add(new Tenant { Id = DemoTenant, Name = "Yugma", Slug = "yugma" });

        if (!await db.RoleDefinitions.AnyAsync(ct))
            db.RoleDefinitions.AddRange(
                new RoleDefinition { Key = "Owner", Label = "Owner", Rank = 4, Assignable = false, Tone = "violet",
                    Description = "Full control of the workspace including billing, data export and deletion.",
                    Permissions = new[] { "Manage billing & subscription", "Add / remove any user", "Transfer ownership", "All admin permissions", "Delete workspace" } },
                new RoleDefinition { Key = "Admin", Label = "Admin", Rank = 3, Assignable = true, Tone = "rose",
                    Description = "Administers users, roles, security policy and integrations.",
                    Permissions = new[] { "Invite & deactivate users", "Assign roles", "Configure SSO & MFA policy", "Manage integrations", "View audit logs" } },
                new RoleDefinition { Key = "Manager", Label = "Manager", Rank = 2, Assignable = true, Tone = "amber",
                    Description = "Manages their team — people, attendance, leave and performance within scope.",
                    Permissions = new[] { "View team directory", "Approve leave & attendance", "Run performance reviews", "Reassign reporting lines" } },
                new RoleDefinition { Key = "Member", Label = "Member", Rank = 1, Assignable = true, Tone = "sky",
                    Description = "Standard employee access to their own records and assigned modules.",
                    Permissions = new[] { "View own profile & payslips", "Apply for leave", "Update personal details", "Access assigned modules" } });

        if (!await db.HierarchyLevels.AnyAsync(ct))
            db.HierarchyLevels.AddRange(
                new HierarchyLevel { Rank = 1,  Code = "L1",  Title = "Trainee",          Description = "Entry-level; learning the role under close supervision." },
                new HierarchyLevel { Rank = 2,  Code = "L2",  Title = "Associate",        Description = "Individual contributor delivering defined tasks." },
                new HierarchyLevel { Rank = 3,  Code = "L3",  Title = "Senior Associate", Description = "Experienced IC owning modules with limited guidance." },
                new HierarchyLevel { Rank = 4,  Code = "L4",  Title = "Team Lead",        Description = "Leads a small team and coordinates day-to-day delivery." },
                new HierarchyLevel { Rank = 5,  Code = "L5",  Title = "Manager",          Description = "Owns a team's outcomes, people and hiring." },
                new HierarchyLevel { Rank = 6,  Code = "L6",  Title = "Senior Manager",   Description = "Manages managers or a large function within a department." },
                new HierarchyLevel { Rank = 7,  Code = "L7",  Title = "Director",         Description = "Owns a department's strategy and budget." },
                new HierarchyLevel { Rank = 8,  Code = "L8",  Title = "VP",               Description = "Vice President across multiple departments." },
                new HierarchyLevel { Rank = 9,  Code = "L9",  Title = "Business Head",    Description = "Heads a business unit / P&L." },
                new HierarchyLevel { Rank = 10, Code = "L10", Title = "CEO",              Description = "Chief Executive — top of the organization." });

        // Leave types — codes MUST match the LeaveType enum names. Added idempotently so new types
        // (Paid/Special/Blocked/RestrictedHoliday) appear even on an already-seeded database.
        var leaveTypes = new[]
        {
            new LeaveTypeConfig { Code = "Casual",           Label = "Casual",            AnnualEntitlement = 12, SortOrder = 1 },
            new LeaveTypeConfig { Code = "Sick",             Label = "Sick",              AnnualEntitlement = 12, SortOrder = 2 },
            new LeaveTypeConfig { Code = "Earned",           Label = "Earned",            AnnualEntitlement = 18, SortOrder = 3 },
            new LeaveTypeConfig { Code = "Paid",             Label = "Paid leave",        AnnualEntitlement = 12, SortOrder = 4 },
            new LeaveTypeConfig { Code = "CompOff",          Label = "Comp-off",          AnnualEntitlement = 6,  SortOrder = 5 },
            new LeaveTypeConfig { Code = "Special",          Label = "Special leave",     AnnualEntitlement = 5,  SortOrder = 6 },
            new LeaveTypeConfig { Code = "Blocked",          Label = "Blocked leave",     AnnualEntitlement = 3,  SortOrder = 7 },
            new LeaveTypeConfig { Code = "RestrictedHoliday", Label = "Restricted Holiday", AnnualEntitlement = 2, SortOrder = 8 }
        };
        var existingLeaveCodes = (await db.LeaveTypes.Select(t => t.Code).ToListAsync(ct)).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var newLeaveTypes = leaveTypes.Where(t => !existingLeaveCodes.Contains(t.Code)).ToList();
        if (newLeaveTypes.Count > 0) db.LeaveTypes.AddRange(newLeaveTypes);

        if (!await db.PayrollSettings.AnyAsync(ct))
            db.PayrollSettings.Add(new PayrollSetting
            {
                Id = 1,
                BasicPctOfGross = 0.40m, HraPctOfBasic = 0.50m, Conveyance = 1600m, PfPctOfBasic = 0.12m,
                ProfessionalTax = 200m, EsiGrossThreshold = 21_000m, EsiEmployeePct = 0.0075m, EsiEmployerPct = 0.0325m,
                StandardDeduction = 75_000m, RebateTaxableLimit = 700_000m, CessPct = 0.04m
            });

        if (!await db.TaxSlabs.AnyAsync(ct))
            db.TaxSlabs.AddRange(
                new TaxSlab { UpTo = 300_000m,    Rate = 0.00m, SortOrder = 1 },
                new TaxSlab { UpTo = 600_000m,    Rate = 0.05m, SortOrder = 2 },
                new TaxSlab { UpTo = 900_000m,    Rate = 0.10m, SortOrder = 3 },
                new TaxSlab { UpTo = 1_200_000m,  Rate = 0.15m, SortOrder = 4 },
                new TaxSlab { UpTo = 1_500_000m,  Rate = 0.20m, SortOrder = 5 },
                new TaxSlab { UpTo = 99_999_999m, Rate = 0.30m, SortOrder = 6 });

        if (!await db.Competencies.AnyAsync(ct))
            db.Competencies.AddRange(
                new CompetencyDefinition { Name = "Delivery",      SortOrder = 1 },
                new CompetencyDefinition { Name = "Collaboration", SortOrder = 2 },
                new CompetencyDefinition { Name = "Ownership",     SortOrder = 3 },
                new CompetencyDefinition { Name = "Innovation",    SortOrder = 4 },
                new CompetencyDefinition { Name = "Communication", SortOrder = 5 });

        if (!await db.Holidays.AnyAsync(h => h.Year == 2026, ct))
        {
            Holiday Pub(string d, string n) => new() { Date = DateOnly.Parse(d), Name = n, Type = "Public", Year = 2026 };
            Holiday Opt(string d, string n) => new() { Date = DateOnly.Parse(d), Name = n, Type = "Optional", Year = 2026 };
            db.Holidays.AddRange(
                // Government / public holidays (mandatory, company-wide)
                Pub("2026-01-26", "Republic Day"),
                Pub("2026-03-06", "Holi"),
                Pub("2026-04-03", "Good Friday"),
                Pub("2026-05-01", "Labour Day"),
                Pub("2026-08-15", "Independence Day"),
                Pub("2026-08-28", "Janmashtami"),
                Pub("2026-10-02", "Gandhi Jayanti"),
                Pub("2026-10-20", "Dussehra"),
                Pub("2026-11-08", "Diwali"),
                Pub("2026-12-25", "Christmas"),
                // Optional / Restricted Holidays (employee picks up to their RH entitlement)
                Opt("2026-01-14", "Makar Sankranti / Pongal"),
                Opt("2026-04-14", "Dr. Ambedkar Jayanti"),
                Opt("2026-05-27", "Eid al-Adha"),
                Opt("2026-09-14", "Onam"),
                Opt("2026-11-09", "Bhai Dooj"),
                Opt("2026-11-24", "Guru Nanak Jayanti"));
        }

        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedEmployeesAsync(YugmaDbContext db, CancellationToken ct)
    {
        if (await db.Employees.IgnoreQueryFilters().AnyAsync(ct)) return;

        var seed = new (string Code, string First, string Last, string Email, string Phone, string Dept, string Title, string Mgr, string Loc, EmploymentType Type, string Joined, decimal Ctc, byte Perf, string[] Skills)[]
        {
            ("YUG-1001","Priya","Sharma","priya.sharma@yugma.io","+91 98203 12233","Engineering","Engineering Director","Aarav Verma","Bengaluru",EmploymentType.FullTime,"2019-06-12",78,5, new[]{"Leadership","Java","Distributed systems"}),
            ("YUG-1002","Rohan","Mehta","rohan.mehta@yugma.io","+91 98123 67710","Procurement","Procurement Lead","Vikram Singh","Pune",EmploymentType.FullTime,"2021-02-01",24,4, new[]{"Negotiation","Vendor mgmt","SAP MM"}),
            ("YUG-1003","Sneha","Iyer","sneha.iyer@yugma.io","+91 91234 55661","Customer Success","CSM, Enterprise","Priya Sharma","Bengaluru",EmploymentType.FullTime,"2022-08-15",18,5, new[]{"Onboarding","Renewals","Notion"}),
            ("YUG-1004","Karthik","Nair","karthik.nair@yugma.io","+91 97654 11220","Finance","Finance Manager","Aarav Verma","Mumbai",EmploymentType.FullTime,"2020-11-03",32,4, new[]{"GL","FP&A","NetSuite"}),
            ("YUG-1005","Ananya","Rao","ananya.rao@yugma.io","+91 98444 17822","Engineering","Senior Engineer","Priya Sharma","Bengaluru",EmploymentType.FullTime,"2023-01-09",26,4, new[]{"TypeScript","Angular",".NET"}),
            ("YUG-1006","Devansh","Patel","devansh.patel@yugma.io","+91 99888 21100","Engineering","Engineering Manager","Priya Sharma","Hyderabad",EmploymentType.FullTime,"2018-04-22",54,5, new[]{"Architecture","AWS","Kubernetes"}),
            ("YUG-1007","Meera","Krishnan","meera.krishnan@yugma.io","+91 98011 11000","Sales","Account Executive","Vikram Singh","Bengaluru",EmploymentType.FullTime,"2022-03-14",22,3, new[]{"SaaS","Hubspot","Discovery"}),
            ("YUG-1008","Vikram","Singh","vikram.singh@yugma.io","+91 90000 33445","Sales","Head of Sales","Aarav Verma","Delhi",EmploymentType.FullTime,"2017-07-18",92,5, new[]{"Leadership","RevOps","MEDDIC"}),
            ("YUG-1009","Aisha","Khan","aisha.khan@yugma.io","+91 95555 78990","Marketing","Brand Manager","Aarav Verma","Mumbai",EmploymentType.FullTime,"2021-09-12",28,4, new[]{"Brand","Content","Figma"}),
            ("YUG-1010","Niharika","Joshi","niharika.joshi@yugma.io","+91 99887 65432","People","HRBP","Aarav Verma","Pune",EmploymentType.FullTime,"2020-02-04",24,4, new[]{"Hiring","Comp","Workday"}),
            ("YUG-1011","Rahul","Kapoor","rahul.kapoor@yugma.io","+91 92345 00120","Engineering","Staff Engineer","Devansh Patel","Bengaluru",EmploymentType.FullTime,"2019-12-01",62,5, new[]{"Distributed systems","Postgres","Kafka"}),
            ("YUG-1012","Tanvi","Bhatt","tanvi.bhatt@yugma.io","+91 90011 22334","Product","Senior PM","Aarav Verma","Bengaluru",EmploymentType.FullTime,"2022-05-30",34,4, new[]{"Discovery","Roadmaps","Linear"})
        };

        foreach (var s in seed)
        {
            var emp = Employee.Create(
                DemoTenant, s.Code,
                PersonName.Create($"{s.First} {s.Last}"),
                Email.Create(s.Email),
                PhoneNumber.Create(s.Phone),
                s.Dept, s.Title, s.Loc,
                s.Type,
                DateOnly.Parse(s.Joined),
                s.Ctc, s.Mgr, s.Skills,
                "seed");
            emp.RecordPerformance(s.Perf, "seed");
            db.Employees.Add(emp);
        }
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Establishes the L1..L10 hierarchy: guarantees a CEO (Aarav Verma, L10) exists, then idempotently
    /// backfills each employee's <c>Band</c> (from designation keywords) and <c>ManagerId</c> (by resolving
    /// the manager-name snapshot to an employee). Re-runnable: skips employees that already have a band.
    /// </summary>
    private static async Task SeedHierarchyAsync(YugmaDbContext db, CancellationToken ct)
    {
        var employees = await db.Employees.IgnoreQueryFilters().ToListAsync(ct);
        if (employees.Count == 0) return;

        // 1) Ensure the CEO exists. Seed managers reference "Aarav Verma" — promote/create as L10 CEO.
        var ceo = employees.FirstOrDefault(e => e.Name.Full.Equals("Aarav Verma", StringComparison.OrdinalIgnoreCase));
        if (ceo is null)
        {
            ceo = Employee.Create(
                DemoTenant, "YUG-1000",
                PersonName.Create("Aarav Verma"),
                Email.Create("aarav.verma@yugma.io"),
                PhoneNumber.Create("+91 99000 10000"),
                "Executive", "Chief Executive Officer", "Bengaluru",
                EmploymentType.FullTime, DateOnly.Parse("2015-01-05"), 240, null,
                new[] { "Leadership", "Strategy", "P&L" }, "seed");
            ceo.RecordPerformance(5, "seed");
            db.Employees.Add(ceo);
            employees.Add(ceo);
            await db.SaveChangesAsync(ct); // persist so the CEO gets an id for the manager chain below
        }

        var byName = employees
            .GroupBy(e => e.Name.Full, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

        var touched = false;
        foreach (var e in employees)
        {
            if (e.Band is not null) continue; // already classified — keep manual changes

            var band = e == ceo ? 10 : BandForTitle(e.Designation);
            e.SetBand(band, "seed");

            // Resolve manager name → employee id (CEO reports to nobody).
            if (e != ceo)
            {
                Guid? mgrId = !string.IsNullOrWhiteSpace(e.Manager) && byName.TryGetValue(e.Manager!, out var m) && m.Id != e.Id
                    ? m.Id
                    : ceo.Id; // fall back to CEO so every trail terminates at the top
                var mgrName = byName.Values.FirstOrDefault(x => x.Id == mgrId)?.Name.Full ?? ceo.Name.Full;
                e.SetManager(mgrId, mgrName, "seed");
            }
            else
            {
                e.SetManager(null, null, "seed");
            }
            touched = true;
        }

        if (touched) await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Ensures each demo login (app_users: owner@/admin@/manager@/associate@yugma.io) also exists as a real
    /// person in the employee directory, with a band and reporting manager. Idempotent (matched by email).
    /// </summary>
    private static async Task SeedPersonaEmployeesAsync(YugmaDbContext db, CancellationToken ct)
    {
        var personas = new (string Name, string Email, string Dept, string Title, string Loc, int Band, string? ManagerName, decimal Ctc, byte Perf, string Phone)[]
        {
            ("Olivia Owner",    "owner@yugma.io",     "Executive",              "Founder & Chairperson", "Bengaluru", 10, null,           300m, 5, "+91 99000 20001"),
            ("Aditya Admin",    "admin@yugma.io",     "Information Technology",  "IT Administrator",      "Bengaluru", 5,  "Aarav Verma",  32m,  4, "+91 99000 20002"),
            ("Maya Manager",    "manager@yugma.io",   "Engineering",             "Engineering Manager",   "Bengaluru", 5,  "Priya Sharma", 48m,  5, "+91 99000 20003"),
            ("Hema Reddy",      "hr@yugma.io",        "Human Resources",         "HR Manager",            "Bengaluru", 5,  "Olivia Owner", 38m,  4, "+91 99000 20005"),
            ("Aaron Associate", "associate@yugma.io", "Engineering",             "Associate Engineer",    "Bengaluru", 2,  "Maya Manager", 12m,  4, "+91 99000 20004")
        };

        var all = await db.Employees.IgnoreQueryFilters().ToListAsync(ct);
        var byName = all.GroupBy(e => e.Name.Full, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);
        var emails = all.Select(e => e.Email.Value).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var nextNum = all.Select(e => int.TryParse(e.Code.Replace("YUG-", "", StringComparison.OrdinalIgnoreCase), out var n) ? n : 0)
            .DefaultIfEmpty(1000).Max();

        var changed = false;

        // Standardise the HR department name so "Human Resources" is the one HR department.
        foreach (var e in all.Where(e => e.Department.Equals("People", StringComparison.OrdinalIgnoreCase)))
        {
            e.Reassign("Human Resources", e.Designation, e.Manager, "seed");
            changed = true;
        }
        foreach (var p in personas)
        {
            if (emails.Contains(p.Email)) continue;
            nextNum++;
            var emp = Employee.Create(DemoTenant, $"YUG-{nextNum}",
                PersonName.Create(p.Name), Email.Create(p.Email), PhoneNumber.Create(p.Phone),
                p.Dept, p.Title, p.Loc, EmploymentType.FullTime, DateOnly.Parse("2022-01-10"), p.Ctc, p.ManagerName, null, "seed");
            emp.RecordPerformance(p.Perf, "seed");
            emp.SetBand(p.Band, "seed");
            Guid? mgrId = p.ManagerName is not null && byName.TryGetValue(p.ManagerName, out var m) ? m.Id : null;
            emp.SetManager(mgrId, mgrId is null ? null : p.ManagerName, "seed");
            db.Employees.Add(emp);
            byName[p.Name] = emp;          // so a later persona can report to this one (Aaron → Maya)
            emails.Add(p.Email);
            changed = true;
        }

        // Single-root org: the CEO reports to the owner.
        if (byName.TryGetValue("Olivia Owner", out var olivia) && byName.TryGetValue("Aarav Verma", out var ceo) && ceo.ManagerId is null)
        {
            ceo.SetManager(olivia.Id, "Olivia Owner", "seed");
            changed = true;
        }

        if (changed) await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Seeds a 5-person Engineering team reporting directly to Maya Manager (manager@yugma.io). Each
    /// member also gets a pending request (a leave application and/or an attendance correction) routed to
    /// Maya, so her "My Team · Approvals" inbox has real items to act on. Idempotent per email: a member
    /// (and its seeded requests) is created only the first time it's missing.
    /// </summary>
    private static async Task SeedMayaTeamAsync(YugmaDbContext db, CancellationToken ct)
    {
        var all = await db.Employees.IgnoreQueryFilters().ToListAsync(ct);
        var maya = all.FirstOrDefault(e => e.Email.Value.Equals("manager@yugma.io", StringComparison.OrdinalIgnoreCase));
        if (maya is null) return; // personas not seeded yet — nothing to hang the team off

        var emails = all.Select(e => e.Email.Value).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var nextNum = all.Select(e => int.TryParse(e.Code.Replace("YUG-", "", StringComparison.OrdinalIgnoreCase), out var n) ? n : 0)
            .DefaultIfEmpty(1000).Max();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var team = new[]
        {
            new MayaReport("Riya Sharma", "riya.sharma@yugma.io", "Software Engineer", 3, 18m, 4, "+91 99000 30001",
                new[] { "TypeScript", "Angular" },
                Leave: (LeaveType.Casual, 2, "Cousin's wedding at hometown", today.AddDays(6), today.AddDays(7)),
                Correction: null),
            new MayaReport("Arjun Nair", "arjun.nair@yugma.io", "Associate Engineer", 2, 13m, 4, "+91 99000 30002",
                new[] { "Java", "Spring Boot" },
                Leave: (LeaveType.Sick, 1, "Down with viral fever", today.AddDays(-1), today.AddDays(-1)),
                Correction: (today.AddDays(-2), "present", "09:05", "18:30", "Forgot to punch in — was at the office on time")),
            new MayaReport("Neha Verma", "neha.verma2@yugma.io", "Senior Software Engineer", 3, 24m, 5, "+91 99000 30003",
                new[] { ".NET", "PostgreSQL" },
                Leave: (LeaveType.Earned, 4, "Family vacation to Goa", today.AddDays(12), today.AddDays(15)),
                Correction: null),
            new MayaReport("Karan Gupta", "karan.gupta@yugma.io", "Software Engineer", 3, 19m, 3, "+91 99000 30004",
                new[] { "React", "Node.js" },
                Leave: null,
                Correction: (today.AddDays(-1), "wfh", "09:30", "18:45", "Worked from home — network outage near office")),
            new MayaReport("Sara Khan", "sara.khan@yugma.io", "Associate Engineer", 2, 12m, 4, "+91 99000 30005",
                new[] { "Python", "FastAPI" },
                Leave: (LeaveType.CompOff, 1, "Comp-off for the weekend release", today.AddDays(3), today.AddDays(3)),
                Correction: null)
        };

        var changed = false;
        foreach (var r in team)
        {
            if (emails.Contains(r.Email)) continue; // already seeded (member + its requests)
            nextNum++;
            var emp = Employee.Create(DemoTenant, $"YUG-{nextNum}",
                PersonName.Create(r.Name), Email.Create(r.Email), PhoneNumber.Create(r.Phone),
                "Engineering", r.Title, "Bengaluru", EmploymentType.FullTime, DateOnly.Parse("2023-03-01"),
                r.Ctc, maya.Name.Full, r.Skills, "seed");
            emp.RecordPerformance(r.Perf, "seed");
            emp.SetBand(r.Band, "seed");
            emp.SetManager(maya.Id, maya.Name.Full, "seed");
            db.Employees.Add(emp);

            if (r.Leave is { } lv)
                db.LeaveRequests.Add(LeaveRequest.Create(DemoTenant, r.Name, lv.Type, lv.From, lv.To, lv.Days,
                    LeaveStatus.Pending, lv.Reason, today.AddDays(-1), maya.Name.Full));

            if (r.Correction is { } cr)
                db.AttendanceCorrections.Add(AttendanceCorrection.Create(DemoTenant, emp.Id, r.Name, cr.Date,
                    cr.Status, cr.InTime, cr.OutTime, cr.Reason, maya.Name.Full));

            emails.Add(r.Email);
            changed = true;
        }

        if (changed) await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Seeds a 5-person Human Resources department with a reporting chain that terminates at the CEO:
    /// VP HR (L8) → CEO, Senior HR Manager (L6) → VP, HR Manager (L5) → Senior, and 2 HR Associates (L2) → HR Manager.
    /// Each also gets an ACTIVE login (see <see cref="SeedAppUsersAsync"/>) so the HR access tiers can be tested.
    /// Idempotent per email; processed top-down so each member can resolve its (just-created) manager by name.
    /// </summary>
    private static async Task SeedHrDepartmentAsync(YugmaDbContext db, CancellationToken ct)
    {
        var all = await db.Employees.IgnoreQueryFilters().ToListAsync(ct);
        var byName = all.GroupBy(e => e.Name.Full, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);
        if (!byName.ContainsKey("Aarav Verma")) return; // CEO must exist to anchor the chain
        var emails = all.Select(e => e.Email.Value).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var nextNum = all.Select(e => int.TryParse(e.Code.Replace("YUG-", "", StringComparison.OrdinalIgnoreCase), out var n) ? n : 0)
            .DefaultIfEmpty(1000).Max();

        // Ordered top-down so each row's manager is already in byName (real or just-created).
        var team = new (string Name, string Email, string Title, int Band, string ManagerName, decimal Ctc, byte Perf, string Phone)[]
        {
            ("Vivaan Kapoor", "hr.vp@yugma.io",     "VP, Human Resources", 8, "Aarav Verma",   96m, 5, "+91 99000 40001"),
            ("Sameer Rao",    "hr.srmgr@yugma.io",  "Senior HR Manager",   6, "Vivaan Kapoor", 60m, 5, "+91 99000 40002"),
            ("Leena Pillai",  "hr.mgr@yugma.io",    "HR Manager",          5, "Sameer Rao",    44m, 4, "+91 99000 40003"),
            ("Ishan Mehta",   "hr.assoc1@yugma.io", "HR Associate",        2, "Leena Pillai",  14m, 4, "+91 99000 40004"),
            ("Tara Singh",    "hr.assoc2@yugma.io", "HR Associate",        2, "Leena Pillai",  13m, 4, "+91 99000 40005")
        };

        var changed = false;
        foreach (var r in team)
        {
            if (emails.Contains(r.Email)) continue; // already seeded
            nextNum++;
            var mgr = byName.GetValueOrDefault(r.ManagerName);
            var emp = Employee.Create(DemoTenant, $"YUG-{nextNum}",
                PersonName.Create(r.Name), Email.Create(r.Email), PhoneNumber.Create(r.Phone),
                "Human Resources", r.Title, "Bengaluru", EmploymentType.FullTime, DateOnly.Parse("2021-06-01"),
                r.Ctc, mgr?.Name.Full, null, "seed");
            emp.RecordPerformance(r.Perf, "seed");
            emp.SetBand(r.Band, "seed");
            emp.SetManager(mgr?.Id, mgr?.Name.Full, "seed");
            db.Employees.Add(emp);
            byName[r.Name] = emp; // so the next row can report to this one
            emails.Add(r.Email);
            changed = true;
        }
        if (changed) await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Assigns every employee an explicit HR partner (the HR person responsible for them) so each HR user
    /// is scoped to just their assigned "book" on the Employees directory and every HR screen. Non-HR
    /// employees are spread round-robin across the HR department; HR-dept members roll up to the VP.
    /// Idempotent: only fills in employees that don't yet have a partner.
    /// </summary>
    private static async Task AssignHrPartnersAsync(YugmaDbContext db, CancellationToken ct)
    {
        var all = await db.Employees.IgnoreQueryFilters().OrderBy(e => e.Code).ToListAsync(ct);
        var hrPeople = all
            .Where(e => e.Department.Equals("Human Resources", StringComparison.OrdinalIgnoreCase))
            .ToList();
        if (hrPeople.Count == 0) return;

        var vp = hrPeople.FirstOrDefault(e => e.Designation.Contains("VP", StringComparison.OrdinalIgnoreCase)) ?? hrPeople[0];
        var altForVp = hrPeople.FirstOrDefault(e => e.Id != vp.Id) ?? vp;

        var changed = false;
        var i = 0;
        foreach (var e in all)
        {
            if (e.HrPartnerId is not null) continue;   // already assigned — keep it (idempotent)
            var partner = e.Department.Equals("Human Resources", StringComparison.OrdinalIgnoreCase)
                ? (e.Id == vp.Id ? altForVp : vp)      // the HR team rolls up to the VP (VP → an alternate)
                : hrPeople[i++ % hrPeople.Count];      // spread the rest of the company across the HR team
            e.AssignHrPartner(partner.Id, partner.Name.Full, "seed");
            changed = true;
        }
        if (changed) await db.SaveChangesAsync(ct);
    }

    private sealed record MayaReport(
        string Name, string Email, string Title, int Band, decimal Ctc, byte Perf, string Phone, string[] Skills,
        (LeaveType Type, int Days, string Reason, DateOnly From, DateOnly To)? Leave,
        (DateOnly Date, string Status, string? InTime, string? OutTime, string Reason)? Correction);

    /// <summary>Maps a free-text job title to a hierarchy band (1..10). Order matters — most senior first.</summary>
    private static int BandForTitle(string title)
    {
        var t = (title ?? "").ToLowerInvariant();
        if (t.Contains("ceo") || t.Contains("chief executive")) return 10;          // L10 CEO
        if (t.Contains("business head") || t.Contains("head of") || t.EndsWith(" head")) return 9; // L9 Business Head
        if (t.Contains("vp") || t.Contains("vice president")) return 8;             // L8 VP
        if (t.Contains("director")) return 7;                                       // L7 Director
        if (t.Contains("senior manager") || t.Contains("sr manager") || t.Contains("senior pm")
            || t.Contains("staff") || t.Contains("principal")) return 6;            // L6 Senior Manager
        if (t.Contains("manager") || t.Contains("hrbp")) return 5;                  // L5 Manager
        if (t.Contains("lead")) return 4;                                           // L4 Team Lead
        if (t.Contains("senior") || t.Contains("sr ")) return 3;                    // L3 Senior Associate
        if (t.Contains("trainee") || t.Contains("intern")) return 1;                // L1 Trainee
        return 2;                                                                   // L2 Associate (default)
    }

    private static async Task SeedLeaveAsync(YugmaDbContext db, CancellationToken ct)
    {
        var existing = await db.LeaveRequests.IgnoreQueryFilters().ToListAsync(ct);
        if (existing.Count >= 16) return;               // already seeded with the rich dataset
        if (existing.Count > 0) db.LeaveRequests.RemoveRange(existing); // upgrade the old minimal seed

        var employees = await db.Employees.IgnoreQueryFilters().ToListAsync(ct);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var reasons = new Dictionary<LeaveType, string[]>
        {
            [LeaveType.Casual] = new[] { "Family function", "Personal work", "House shifting", "Festival at hometown" },
            [LeaveType.Sick] = new[] { "Fever and cold", "Medical checkup", "Viral infection", "Dental procedure" },
            [LeaveType.Earned] = new[] { "Vacation with family", "Trip abroad", "Wedding in the family", "Long weekend break" },
            [LeaveType.CompOff] = new[] { "Comp-off for weekend release", "Comp-off for on-call", "Worked on a holiday" }
        };
        var pool = new[] { LeaveType.Casual, LeaveType.Sick, LeaveType.Earned, LeaveType.CompOff };
        var reqs = new List<LeaveRequest>();

        foreach (var e in employees)
        {
            var rng = new Random(BitConverter.ToInt32(e.Id.ToByteArray()) ^ 0x1eaf);
            var mgr = string.IsNullOrWhiteSpace(e.Manager) ? "Reporting manager" : e.Manager!;
            string Reason(LeaveType t) => reasons[t][rng.Next(reasons[t].Length)];

            // 2–4 historical approved leaves (some recent so month-to-date looks healthy).
            int approved = rng.Next(2, 5);
            for (int i = 0; i < approved; i++)
            {
                var type = pool[rng.Next(pool.Length)];
                int len = type == LeaveType.Earned ? rng.Next(3, 8) : rng.Next(1, 3);
                int daysAgo = rng.NextDouble() < 0.45 ? rng.Next(1, 25) : rng.Next(25, 300);
                var from = today.AddDays(-daysAgo);
                var applied = from.AddDays(-rng.Next(4, 14));
                var decided = applied.AddDays(rng.Next(1, 4));
                reqs.Add(LeaveRequest.Create(e.TenantId, e.Name.Full, type, from, from.AddDays(len - 1), len,
                    LeaveStatus.Approved, Reason(type), applied, mgr,
                    DateTime.SpecifyKind(decided.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc), mgr));
            }

            // occasional rejected
            if (rng.NextDouble() < 0.30)
            {
                var type = pool[rng.Next(pool.Length)];
                int len = rng.Next(1, 3);
                var from = today.AddDays(-rng.Next(20, 200));
                var applied = from.AddDays(-rng.Next(3, 10));
                reqs.Add(LeaveRequest.Create(e.TenantId, e.Name.Full, type, from, from.AddDays(len - 1), len,
                    LeaveStatus.Rejected, Reason(type), applied, mgr,
                    DateTime.SpecifyKind(applied.AddDays(1).ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc), mgr));
            }

            // ~38% have a pending request (recent or upcoming)
            if (rng.NextDouble() < 0.38)
            {
                var type = pool[rng.Next(pool.Length)];
                int len = type == LeaveType.Earned ? rng.Next(2, 6) : rng.Next(1, 3);
                var from = today.AddDays(rng.Next(-2, 25));
                var applied = today.AddDays(-rng.Next(0, 6));
                reqs.Add(LeaveRequest.Create(e.TenantId, e.Name.Full, type, from, from.AddDays(len - 1), len,
                    LeaveStatus.Pending, Reason(type), applied, mgr));
            }
        }

        db.LeaveRequests.AddRange(reqs);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Materialises the attendance roster into Postgres: one record per employee per working day across a
    /// rolling window. Stores the FACTS (punches + base status Present/Wfh/Leave/Absent); the controller
    /// recomputes late/overtime under the live policy. Re-seeds if the table only holds the old sample rows.
    /// </summary>
    private static async Task SeedAttendanceAsync(YugmaDbContext db, CancellationToken ct)
    {
        var employees = await db.Employees.IgnoreQueryFilters().ToListAsync(ct);
        if (employees.Count == 0) return;

        var existing = await db.AttendanceRecords.IgnoreQueryFilters().ToListAsync(ct);
        const int windowDays = 45;
        var expected = employees.Count * (windowDays / 2); // rough lower bound (weekdays only)
        if (existing.Count >= expected) return;             // already materialised
        if (existing.Count > 0) db.AttendanceRecords.RemoveRange(existing); // replace the old 5 sample rows

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var batch = new List<AttendanceRecord>();

        foreach (var e in employees)
        {
            for (int back = windowDays; back >= 0; back--)
            {
                var day = today.AddDays(-back);
                if (day.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday) continue; // weekly off → no row

                var rng = Rng(e.Id, day);
                var roll = rng.NextDouble();
                if (roll < 0.04) { batch.Add(AttendanceRecord.Create(e.TenantId, day, e.Name.Full, e.Department, null, null, 0m, AttendanceStatus.Absent, e.Id)); continue; }
                if (roll < 0.10) { batch.Add(AttendanceRecord.Create(e.TenantId, day, e.Name.Full, e.Department, null, null, 0m, AttendanceStatus.Leave, e.Id)); continue; }

                var offset = (int)Math.Round(Math.Pow(rng.NextDouble(), 2.2) * 75); // mins past 09:00
                var inMin = 9 * 60 + offset;
                var hours = Math.Round(8.0 + rng.NextDouble() * 2.2, 1);
                var outMin = inMin + (int)Math.Round(hours * 60) + 60;
                var status = rng.NextDouble() < 0.27 ? AttendanceStatus.Wfh : AttendanceStatus.Present;

                batch.Add(AttendanceRecord.Create(e.TenantId, day, e.Name.Full, e.Department,
                    FmtMinutes(inMin), FmtMinutes(outMin), (decimal)hours, status, e.Id));
            }
        }

        db.AttendanceRecords.AddRange(batch);
        await db.SaveChangesAsync(ct);
    }

    private static Random Rng(Guid id, DateOnly date)
    {
        var bytes = id.ToByteArray();
        int h = date.DayNumber;
        foreach (var x in bytes) h = unchecked(h * 31 + x);
        return new Random(h);
    }

    private static string FmtMinutes(int minutes)
    {
        minutes = ((minutes % 1440) + 1440) % 1440;
        return $"{minutes / 60:00}:{minutes % 60:00}";
    }

    private static async Task SeedPayrollAsync(YugmaDbContext db, CancellationToken ct)
    {
        if (await db.PayrollRuns.IgnoreQueryFilters().AnyAsync(ct)) return;
        db.PayrollRuns.AddRange(
            PayrollRun.Create(DemoTenant, "APR-2026", 9_762_130m, 246, PayrollStatus.Paid, new DateOnly(2026,4,30)),
            PayrollRun.Create(DemoTenant, "MAR-2026", 9_684_900m, 244, PayrollStatus.Paid, new DateOnly(2026,3,31)),
            PayrollRun.Create(DemoTenant, "FEB-2026", 9_510_420m, 242, PayrollStatus.Paid, new DateOnly(2026,2,28)),
            PayrollRun.Create(DemoTenant, "JAN-2026", 9_388_200m, 240, PayrollStatus.Paid, new DateOnly(2026,1,31))
        );
        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedCandidatesAsync(YugmaDbContext db, CancellationToken ct)
    {
        var existing = await db.Candidates.IgnoreQueryFilters().ToListAsync(ct);
        var enriched = existing.Any(c => c.Onboarding != null);    // has the workflow + post-hire onboarding data
        if (existing.Count >= 20 && enriched) return;     // already seeded with the rich workflow pipeline
        if (existing.Count > 0) db.Candidates.RemoveRange(existing);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var rng = new Random(20260529);

        string[] names =
        {
            "Ishaan Kapoor","Aditi Menon","Yash Bhalla","Riya Saxena","Manav Bhardwaj","Pooja Reddy","Arjun Trivedi","Neha Banerjee",
            "Kabir Sethi","Ananya Pillai","Rohan Das","Sara Qureshi","Vivaan Joshi","Diya Nair","Aryan Gupta","Ishita Rao",
            "Kunal Verma","Meghna Shah","Dev Malhotra","Tara Krishnan","Nikhil Anand","Sneha Kulkarni","Aman Khanna","Ridhi Sharma",
            "Karan Mehta","Pari Desai","Veer Chauhan","Anika Iyer","Rudra Patel","Myra Singh","Reyansh Bose","Saanvi Reddy",
            "Aarav Jain","Kiara Dsouza","Laksh Bhat","Navya Menon"
        };
        string[] roles = { "Senior Engineer","Engineering Manager","Account Executive","Product Designer","Customer Success Manager","Finance Analyst","SDR","Data Analyst","Marketing Manager","HR Specialist" };
        string[] sources = { "Referral","LinkedIn","Naukri","Inbound","Hackathon","Indeed","Instahyre" };
        string[] locations = { "Bengaluru","Mumbai","Pune","Delhi","Hyderabad","Chennai","Remote" };
        string[] owners = { "Niharika Joshi","Aarav Verma" };
        (CandidateStage Stage, double W)[] dist =
        {
            (CandidateStage.Applied, 0.30), (CandidateStage.Screening, 0.22), (CandidateStage.Interview, 0.18),
            (CandidateStage.Offer, 0.08), (CandidateStage.Hired, 0.10), (CandidateStage.Rejected, 0.12)
        };

        CandidateStage PickStage()
        {
            var r = rng.NextDouble(); double acc = 0;
            foreach (var (stage, w) in dist) { acc += w; if (r <= acc) return stage; }
            return CandidateStage.Applied;
        }

        var list = new List<Candidate>();
        foreach (var name in names)
        {
            var role = roles[rng.Next(roles.Length)];
            var applied = today.AddDays(-rng.Next(1, 75));
            var last = applied.AddDays(rng.Next(0, 12));
            if (last > today) last = today;
            var email = name.ToLowerInvariant().Replace(' ', '.') + "@example.com";
            list.Add(Candidate.Create(
                DemoTenant, name, role, sources[rng.Next(sources.Length)], PickStage(),
                (byte)rng.Next(3, 6), applied, email, locations[rng.Next(locations.Length)],
                rng.Next(1, 14), 6 + rng.Next(0, 42), owners[rng.Next(owners.Length)], last));
        }

        // Enrich the pipeline with interviewers, feedback and a workflow trail so the
        // "who interviewed / what was the verdict" story is visible end-to-end.
        string[] interviewers = { "Devansh Patel", "Priya Sharma", "Ananya Rao", "Karthik Nair", "Aisha Khan", "Sneha Iyer", "Vikram Singh" };
        string[] recs = { "Strong yes", "Proceed", "Proceed", "Hold", "Reject" };
        string[] rounds = { "Technical", "Hiring manager", "HR", "Bar raiser" };
        string[] comments =
        {
            "Strong fundamentals; communicated clearly and reasoned well through the system-design round.",
            "Good problem solver, a little light on depth in places — worth a follow-up round.",
            "Solid culture fit and ownership mindset. Recommend moving forward.",
            "Borderline on senior-level scope; would re-evaluate after a take-home.",
            "Did not meet the bar on core competencies for this role."
        };
        string Slug(string n) => n.ToLowerInvariant().Replace(' ', '-');

        foreach (var c in list)
        {
            if (rng.NextDouble() < 0.85)
                c.AttachResume($"{Slug(c.Name)}-resume.pdf", $"https://resumes.yugma.example/{Slug(c.Name)}.pdf", "seed");

            var iv = interviewers[rng.Next(interviewers.Length)];
            switch (c.Stage)
            {
                case CandidateStage.Screening:
                    c.Activity.Add(new StageEvent { Kind = "note", Note = "Screening call done — relevant experience, salary expectations in range.", By = c.Owner, At = DateTime.UtcNow });
                    break;
                case CandidateStage.Interview:
                    c.AssignInterviewer(iv, c.LastActivityAt.AddDays(2), c.Owner);
                    break;
                case CandidateStage.Offer:
                case CandidateStage.Hired:
                    c.AssignInterviewer(iv, c.LastActivityAt, c.Owner);
                    for (var r = 0; r < rng.Next(1, 3); r++)
                    {
                        var pick = rng.Next(recs.Length - 1); // bias positive for offer/hired
                        c.AddFeedback(interviewers[rng.Next(interviewers.Length)], rounds[r % rounds.Length], (byte)rng.Next(4, 6), recs[pick], comments[pick], iv);
                    }
                    break;
                case CandidateStage.Rejected:
                    c.AssignInterviewer(iv, c.LastActivityAt, c.Owner);
                    c.AddFeedback(iv, "Technical", (byte)rng.Next(1, 3), "Reject", comments[4], iv);
                    break;
            }

            // Post-hire onboarding: spread hired candidates across the process so every step is visible.
            if (c.Stage == CandidateStage.Hired)
            {
                c.StartOnboarding(c.Owner);
                var level = rng.Next(0, 4);              // 0 = documents, 1 = background, 2 = offer released, 3 = accepted
                var docs = c.Onboarding!.Documents;
                var verifyCount = level >= 1 ? docs.Count : rng.Next(1, docs.Count);
                for (var i = 0; i < docs.Count; i++)
                    c.SetDocument(docs[i].Name, i < verifyCount ? "verified" : "pending", null, c.Owner);
                var joining = today.AddDays(rng.Next(15, 45));
                if (level >= 1) c.UpdateBackgroundCheck("cleared", "HireRight India", "Employment, education and ID checks passed.", c.Owner);
                if (level >= 2) c.ReleaseOfferLetter($"{Slug(c.Name)}-offer.pdf", $"https://offers.yugma.example/{Slug(c.Name)}.pdf", joining, (decimal)(8 + rng.Next(0, 40)), c.Owner);
                if (level >= 3) c.RecordAcceptance("accepted", "Accepted — looking forward to joining the team!", joining, c.Owner);
            }
        }

        db.Candidates.AddRange(list);
        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedJobOpeningsAsync(YugmaDbContext db, CancellationToken ct)
    {
        if (await db.JobOpenings.IgnoreQueryFilters().AnyAsync(ct)) return;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        JobOpening J(string title, string dept, string loc, string type, int openings, JobStatus status, string mgr, decimal budget, string priority, int postedDaysAgo)
            => JobOpening.Create(DemoTenant, title, dept, loc, type, openings, status, mgr, budget, today.AddDays(-postedDaysAgo), priority);

        db.JobOpenings.AddRange(
            J("Senior Engineer", "Engineering", "Bengaluru", "Full-time", 3, JobStatus.Open, "Devansh Patel", 32, "High", 20),
            J("Staff Engineer", "Engineering", "Bengaluru", "Full-time", 1, JobStatus.Open, "Devansh Patel", 55, "High", 5),
            J("Engineering Manager", "Engineering", "Hyderabad", "Full-time", 1, JobStatus.Open, "Priya Sharma", 48, "High", 12),
            J("Account Executive", "Sales", "Delhi", "Full-time", 2, JobStatus.Open, "Vikram Singh", 22, "Medium", 30),
            J("SDR", "Sales", "Bengaluru", "Full-time", 2, JobStatus.Open, "Vikram Singh", 12, "Medium", 9),
            J("Product Designer", "Product", "Bengaluru", "Full-time", 1, JobStatus.Open, "Tanvi Bhatt", 26, "Medium", 18),
            J("Data Analyst", "Product", "Remote", "Full-time", 1, JobStatus.OnHold, "Tanvi Bhatt", 18, "Low", 40),
            J("Customer Success Manager", "Customer Success", "Mumbai", "Full-time", 2, JobStatus.Open, "Sneha Iyer", 20, "Medium", 15),
            J("Finance Analyst", "Finance", "Mumbai", "Full-time", 1, JobStatus.Open, "Karthik Nair", 16, "Low", 25),
            J("Marketing Manager", "Marketing", "Mumbai", "Full-time", 1, JobStatus.Open, "Aisha Khan", 28, "Medium", 22),
            J("HR Specialist", "People", "Pune", "Full-time", 1, JobStatus.Open, "Niharika Joshi", 14, "Low", 7),
            J("Procurement Executive", "Procurement", "Pune", "Contract", 1, JobStatus.Closed, "Rohan Mehta", 10, "Low", 60)
        );
        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedEmployeeDocumentsAsync(YugmaDbContext db, CancellationToken ct)
    {
        var employees = await db.Employees.IgnoreQueryFilters().ToListAsync(ct);
        if (employees.Count == 0) return;

        // Idempotent per-employee: only generate the mandatory document set for employees that
        // have none yet, so personas/joiners added in a later seed run get backfilled (the old
        // "skip if any document exists" guard left them with an empty Documents tab).
        var alreadyHaveDocs = (await db.EmployeeDocuments.IgnoreQueryFilters()
            .Select(d => d.EmployeeId).Distinct().ToListAsync(ct)).ToHashSet();

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var docs = new List<EmployeeDocument>();

        foreach (var e in employees)
        {
            if (alreadyHaveDocs.Contains(e.Id)) continue;

            var r = new Random(BitConverter.ToInt32(e.Id.ToByteArray()));
            long Kb(int min, int max) => r.Next(min, max) * 1024L;
            var joined = e.JoinedAt;

            // ---- mandatory company documents (required for every employee on file) ----
            docs.Add(EmployeeDocument.Create(e.TenantId, e.Id, "Offer Letter", "Contract", "PDF", Kb(180, 420), DocumentStatus.Verified, joined.AddDays(-7), null, "HR Onboarding"));
            docs.Add(EmployeeDocument.Create(e.TenantId, e.Id, "Appointment Letter", "Contract", "PDF", Kb(220, 480), DocumentStatus.Verified, joined, null, "HR Onboarding"));
            docs.Add(EmployeeDocument.Create(e.TenantId, e.Id, "Employment Agreement", "Contract", "PDF", Kb(320, 720), DocumentStatus.Verified, joined, null, "HR Onboarding"));
            docs.Add(EmployeeDocument.Create(e.TenantId, e.Id, "Non-Disclosure Agreement", "Compliance", "PDF", Kb(160, 360), DocumentStatus.Verified, joined, null, "HR Onboarding"));
            docs.Add(EmployeeDocument.Create(e.TenantId, e.Id, "PAN Card", "Identity", "JPG", Kb(90, 260), DocumentStatus.Verified, joined.AddDays(1), null, e.Name.Full));
            docs.Add(EmployeeDocument.Create(e.TenantId, e.Id, "Aadhaar Card", "Identity", "PDF", Kb(120, 300), DocumentStatus.Verified, joined.AddDays(1), null, e.Name.Full));
            docs.Add(EmployeeDocument.Create(e.TenantId, e.Id, "Passport-size Photograph", "Identity", "JPG", Kb(40, 120), DocumentStatus.Verified, joined.AddDays(1), null, e.Name.Full));
            docs.Add(EmployeeDocument.Create(e.TenantId, e.Id, "Bank Account Proof (Cancelled Cheque)", "Compliance", "PDF", Kb(80, 200), DocumentStatus.Verified, joined.AddDays(2), null, e.Name.Full));
            docs.Add(EmployeeDocument.Create(e.TenantId, e.Id, "Educational Certificates", "Certificate", "PDF", Kb(400, 1200), DocumentStatus.Verified, joined.AddDays(2), null, e.Name.Full));
            docs.Add(EmployeeDocument.Create(e.TenantId, e.Id, "Background Verification Report", "Compliance", "PDF", Kb(180, 420), DocumentStatus.Verified, joined.AddDays(r.Next(7, 30)), null, "HR Compliance"));
            docs.Add(EmployeeDocument.Create(e.TenantId, e.Id, "Form 16 — FY 2024-25", "Payroll", "PDF", Kb(140, 360), DocumentStatus.Verified, new DateOnly(2025, 6, 15), null, "Finance"));

            // Relieving / experience letter from the previous employer — not applicable to a
            // trainee/intern joining their first job.
            var firstJob = e.Band is <= 1 || e.EmploymentType == EmploymentType.Intern;
            if (!firstJob)
                docs.Add(EmployeeDocument.Create(e.TenantId, e.Id, "Relieving Letter — Previous Employer", "Contract", "PDF", Kb(120, 300), DocumentStatus.Verified, joined.AddDays(-2), null, "HR Onboarding"));

            var cert = e.Skills.Count > 0 ? $"{e.Skills[0]} Certification" : "Professional Certification";
            docs.Add(EmployeeDocument.Create(e.TenantId, e.Id, cert, "Certificate", "PDF", Kb(200, 500), DocumentStatus.Verified, joined.AddMonths(r.Next(3, 20)), today.AddMonths(r.Next(4, 20)), e.Name.Full));

            if (r.NextDouble() < 0.45)
                docs.Add(EmployeeDocument.Create(e.TenantId, e.Id, "Address Proof (updated)", "Compliance", "PDF", Kb(90, 240), DocumentStatus.Pending, today.AddDays(-r.Next(2, 25)), null, e.Name.Full));
        }

        if (docs.Count == 0) return;
        db.EmployeeDocuments.AddRange(docs);
        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedInvoicesAsync(YugmaDbContext db, CancellationToken ct)
    {
        if (await db.Invoices.IgnoreQueryFilters().AnyAsync(ct)) return;
        db.Invoices.AddRange(
            Invoice.Create(DemoTenant, "INV-2026-0421", "Globex Industries", new DateOnly(2026,5,4),  new DateOnly(2026,5,18), 845_000m, InvoiceStatus.Paid),
            Invoice.Create(DemoTenant, "INV-2026-0420", "Initech Labs",      new DateOnly(2026,5,3),  new DateOnly(2026,5,17), 218_400m, InvoiceStatus.Pending),
            Invoice.Create(DemoTenant, "INV-2026-0419", "Wayne Enterprises", new DateOnly(2026,5,1),  new DateOnly(2026,5,15), 612_000m, InvoiceStatus.Overdue),
            Invoice.Create(DemoTenant, "INV-2026-0418", "Stark Industries",  new DateOnly(2026,4,29), new DateOnly(2026,5,13), 376_500m, InvoiceStatus.Paid),
            Invoice.Create(DemoTenant, "INV-2026-0417", "Umbrella Corp",     new DateOnly(2026,4,28), new DateOnly(2026,5,12), 182_000m, InvoiceStatus.Pending)
        );
        await db.SaveChangesAsync(ct);
    }
    private static async Task SeedAuditLogsAsync(YugmaDbContext db, CancellationToken ct)
    {
        if (await db.AuditLogs.IgnoreQueryFilters().AnyAsync(ct)) return;
        var now = DateTime.UtcNow;
        db.AuditLogs.AddRange(
            AuditLog.Create(DemoTenant, now.AddMinutes(-3),  "Priya Sharma",   "invoice.approve",    "INV-2026-0421",          "10.42.18.4",     AuditOutcome.Success),
            AuditLog.Create(DemoTenant, now.AddMinutes(-12), "System",         "payroll.run.start",  "cycle:MAY-2026",         null,             AuditOutcome.Success),
            AuditLog.Create(DemoTenant, now.AddMinutes(-45), "Rohan Mehta",    "po.create",          "PO-7782",                "203.0.113.45",   AuditOutcome.Success),
            AuditLog.Create(DemoTenant, now.AddMinutes(-90), "Devansh Patel",  "auth.mfa.failed",    "session:f1c0",           "198.51.100.7",   AuditOutcome.Failed),
            AuditLog.Create(DemoTenant, now.AddHours(-4),    "Aisha Khan",     "user.role.change",   "user:u_445 -> manager",  "10.42.19.2",     AuditOutcome.Success)
        );
        await db.SaveChangesAsync(ct);
    }

    // Shared demo password for every seeded login (documented for testers).
    private const string DemoPassword = "Yugma@123";

    private static async Task SeedServicesAsync(YugmaDbContext db, CancellationToken ct)
    {
        if (await db.ServiceOrders.IgnoreQueryFilters().AnyAsync(ct)) return;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var nowUtc = DateTime.UtcNow;
        var rng = new Random(20260607);

        var team = new[] { "Sahil Verma", "Rohit Sharma", "Anjali Gupta" };
        var customers = new[] { "Deco Addict", "Ready Mat", "Gemini Furniture", "Azure Interior", "The Jackson Group", "Lumber Inc", "YourCompany" };

        // (Title, Type, Stage, Priority, estHours, tags, dueOffsetDays)
        var defs = new (string Title, ServiceType Type, ServiceStage Stage, ServicePriority Priority, decimal Est, string[] Tags, int DueIn)[]
        {
            ("Office redesign — phase 2",            ServiceType.Project,      ServiceStage.InProgress, ServicePriority.High,   80, new[]{"Design","Internal"}, 21),
            ("Website revamp delivery",              ServiceType.Project,      ServiceStage.Review,     ServicePriority.Medium, 60, new[]{"External"},          7),
            ("ERP rollout — finance module",         ServiceType.Project,      ServiceStage.New,        ServicePriority.High,   120,new[]{"Implementation"},    45),
            ("Showroom AC installation",             ServiceType.FieldService, ServiceStage.Scheduled,  ServicePriority.Medium, 6,  new[]{"On-site"},           3),
            ("Conveyor belt breakdown repair",       ServiceType.FieldService, ServiceStage.InProgress, ServicePriority.Urgent, 8,  new[]{"On-site","Urgent"},  1),
            ("Quarterly equipment maintenance",      ServiceType.FieldService, ServiceStage.New,        ServicePriority.Low,    4,  new[]{"Preventive"},        14),
            ("Network outage at branch office",      ServiceType.Helpdesk,     ServiceStage.InProgress, ServicePriority.Urgent, 5,  new[]{"P1","Infra"},        1),
            ("Login issues after password reset",    ServiceType.Helpdesk,     ServiceStage.New,        ServicePriority.Medium, 2,  new[]{"Access"},            2),
            ("Printer driver not working",           ServiceType.Helpdesk,     ServiceStage.Review,     ServicePriority.Low,    1,  new[]{"Hardware"},          1),
            ("Email delivery delays",                ServiceType.Helpdesk,     ServiceStage.Done,       ServicePriority.High,   3,  new[]{"Email"},            -2),
            ("Onboarding consultation call",         ServiceType.Appointment,  ServiceStage.Scheduled,  ServicePriority.Medium, 1,  new[]{"Consult"},           2),
            ("Annual contract review meeting",       ServiceType.Appointment,  ServiceStage.New,        ServicePriority.Low,    1,  new[]{"Account"},           10),
            ("Site survey for new fit-out",          ServiceType.Appointment,  ServiceStage.Done,       ServicePriority.Medium, 2,  new[]{"Survey"},           -5),
            ("Kitchen remodel project",              ServiceType.Project,      ServiceStage.Scheduled,  ServicePriority.Medium, 50, new[]{"External"},          18),
            ("Generator servicing — HQ",             ServiceType.FieldService, ServiceStage.Review,     ServicePriority.Medium, 5,  new[]{"On-site"},           2),
            ("VPN access request",                   ServiceType.Helpdesk,     ServiceStage.Done,       ServicePriority.Low,    1,  new[]{"Access"},           -1)
        };

        var n = 1000;
        var orders = new List<ServiceOrder>();
        foreach (var d in defs)
        {
            n++;
            var assignee = d.Stage == ServiceStage.New ? null : team[rng.Next(team.Length)];
            DateTime? scheduled = d.Stage is ServiceStage.Scheduled or ServiceStage.InProgress or ServiceStage.Review
                ? nowUtc.Date.AddDays(rng.Next(-4, 6)).AddHours(9 + rng.Next(0, 8))
                : (d.Stage == ServiceStage.Done ? nowUtc.Date.AddDays(-rng.Next(2, 10)) : null);
            var due = today.AddDays(d.DueIn);

            var o = ServiceOrder.Create(DemoTenant, $"SVC-{n}", d.Title, d.Type, customers[rng.Next(customers.Length)],
                d.Stage, d.Priority, assignee, scheduled, due, d.Est, null, d.Tags, "seed");
            orders.Add(o);
        }
        db.ServiceOrders.AddRange(orders);

        // Time entries on the orders that are in flight or finished.
        var notes = new[] { "On-site diagnosis", "Implementation work", "Customer call", "Testing & sign-off", "Parts replacement", "Remote troubleshooting" };
        foreach (var o in orders)
        {
            if (o.Stage is ServiceStage.New or ServiceStage.Cancelled || o.AssignedTo is null) continue;
            var sessions = o.Stage == ServiceStage.Done ? rng.Next(2, 5) : rng.Next(1, 4);
            for (var i = 0; i < sessions; i++)
            {
                var date = today.AddDays(-rng.Next(0, 9));
                var hours = Math.Round((decimal)(1 + rng.NextDouble() * 4), 1);
                db.ServiceTimesheets.Add(ServiceTimesheet.Create(DemoTenant, o.Id, o.AssignedTo!, date, hours, notes[rng.Next(notes.Length)], "seed"));
            }
        }

        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedHrModulesAsync(YugmaDbContext db, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var rng = new Random(20260609);

        // ---- Employee referrals ----
        if (!await db.EmployeeReferrals.IgnoreQueryFilters().AnyAsync(ct))
        {
            var referrers = new[] { "Devansh Patel", "Priya Sharma", "Ananya Rao", "Aisha Khan", "Karthik Nair", "Sneha Iyer" };
            var candidates = new[] { "Aryan Khanna", "Diya Kapoor", "Vihaan Reddy", "Ira Nair", "Kabir Anand", "Mira Joshi", "Reyansh Shah", "Anaya Pillai", "Vivaan Rao", "Sara Mehta" };
            var positions = new[] { "Senior Engineer", "Product Designer", "Account Executive", "Finance Analyst", "Data Analyst", "Marketing Manager" };
            var depts = new[] { "Engineering", "Design", "Sales", "Finance", "Product", "Marketing" };
            (ReferralStatus Status, bool Paid)[] plan =
            {
                (ReferralStatus.New, false), (ReferralStatus.New, false), (ReferralStatus.InReview, false),
                (ReferralStatus.Interviewing, false), (ReferralStatus.Interviewing, false),
                (ReferralStatus.Hired, true), (ReferralStatus.Hired, false), (ReferralStatus.Hired, false),
                (ReferralStatus.NotSelected, false), (ReferralStatus.NotSelected, false)
            };
            for (var i = 0; i < plan.Length; i++)
            {
                var slug = candidates[i].ToLowerInvariant().Replace(' ', '.');
                var r = EmployeeReferral.Create(DemoTenant, referrers[rng.Next(referrers.Length)], candidates[i], positions[rng.Next(positions.Length)],
                    $"{slug}@example.com", depts[rng.Next(depts.Length)], plan[i].Status, today.AddDays(-rng.Next(3, 70)),
                    rng.Next(0, 2) == 0 ? 50000m : 75000m, null, "seed");
                if (plan[i].Paid) r.MarkBonusPaid("seed");
                db.EmployeeReferrals.Add(r);
            }
            await db.SaveChangesAsync(ct);
        }

        // ---- Fleet vehicles ----
        if (!await db.Vehicles.IgnoreQueryFilters().AnyAsync(ct))
        {
            (string Name, string Plate, VehicleType Type, VehicleStatus Status, string? Driver, string Fuel, int Odo, int ServiceIn)[] fleet =
            {
                ("Toyota Innova Crysta", "KA01AB1234", VehicleType.Car, VehicleStatus.InUse, "Devansh Patel", "Diesel", 48200, 12),
                ("Maruti Ertiga", "KA05CD5678", VehicleType.Car, VehicleStatus.Available, null, "Petrol", 21500, 40),
                ("Tata Ace", "KA03EF9012", VehicleType.Truck, VehicleStatus.InUse, "Rohit Sharma", "Diesel", 95400, -3),
                ("Mahindra Bolero", "KA02GH3456", VehicleType.Van, VehicleStatus.Maintenance, null, "Diesel", 132000, 5),
                ("Royal Enfield Classic", "KA09IJ7890", VehicleType.Bike, VehicleStatus.Available, null, "Petrol", 8800, 60),
                ("Force Traveller", "KA04KL2345", VehicleType.Bus, VehicleStatus.InUse, "Anjali Gupta", "Diesel", 67300, 22),
                ("Hyundai Aura", "KA07MN6789", VehicleType.Car, VehicleStatus.Retired, null, "CNG", 158900, 0)
            };
            foreach (var f in fleet)
            {
                db.Vehicles.Add(Vehicle.Create(DemoTenant, f.Name, f.Plate, f.Type, today.AddDays(-rng.Next(200, 1500)),
                    f.Status, f.Driver, f.Fuel, f.Odo, f.Status == VehicleStatus.Retired ? null : today.AddDays(f.ServiceIn), null, "seed"));
            }
            await db.SaveChangesAsync(ct);
        }

        // A few approved unpaid (LOP) leaves in the current month so payroll LOP is demonstrable.
        var hasLop = await db.LeaveRequests.IgnoreQueryFilters()
            .AnyAsync(r => r.Type == Domain.Hr.Leave.LeaveType.Unpaid && r.Status == Domain.Hr.Leave.LeaveStatus.Approved
                && r.FromDate.Year == today.Year && r.FromDate.Month == today.Month, ct);
        if (!hasLop)
        {
            var dim = DateTime.DaysInMonth(today.Year, today.Month);
            (string Emp, int FromDay, int Days)[] lop = { ("Aaron Associate", 5, 2), ("Ananya Rao", 12, 3), ("Karthik Nair", 20, 1) };
            foreach (var f in lop)
            {
                var from = new DateOnly(today.Year, today.Month, Math.Min(f.FromDay, dim));
                var to = from.AddDays(Math.Min(f.Days - 1, dim - from.Day));
                db.LeaveRequests.Add(Domain.Hr.Leave.LeaveRequest.Create(DemoTenant, f.Emp, Domain.Hr.Leave.LeaveType.Unpaid,
                    from, to, to.DayNumber - from.DayNumber + 1, Domain.Hr.Leave.LeaveStatus.Approved, "Unpaid leave",
                    today.AddDays(-6), "HR", DateTime.UtcNow.AddDays(-5), "HR"));
            }
            await db.SaveChangesAsync(ct);
        }

        // Backfill statutory IDs + bank details on employees (real values used by the payslip).
        var needIds = await db.Employees.IgnoreQueryFilters().Where(e => e.Pan == null).ToListAsync(ct);
        if (needIds.Count > 0)
        {
            string[] banks = { "AXIS BANK LTD", "HDFC BANK LTD", "ICICI BANK LTD", "STATE BANK OF INDIA", "KOTAK MAHINDRA BANK" };
            static long Fnv(string s) { unchecked { long h = 1469598103934665603; foreach (var c in s) { h ^= c; h *= 1099511628211; } return Math.Abs(h); } }
            foreach (var e in needIds)
            {
                var s = Fnv(e.Id.ToString());
                var letters = new string(e.Name.Full.ToUpperInvariant().Where(char.IsLetter).DefaultIfEmpty('X').Take(5).ToArray()).PadRight(5, 'X');
                var pan = $"{letters}{s % 9000 + 1000}{(char)('A' + (int)(s % 26))}";
                var uan = (100000000000 + s % 899999999999).ToString();
                var pf = $"SUBHA/BG/{s % 9000 + 1000}/{s % 900000 + 100000}";
                var bank = banks[(int)(s % banks.Length)];
                var acct = (s % 900000000000 + 100000000000).ToString();
                e.SetStatutory(s % 2 == 0 ? "Male" : "Female", pan, uan, pf, bank, acct, "seed");
            }
            await db.SaveChangesAsync(ct);
        }
    }

    private static async Task SeedSalesAsync(YugmaDbContext db, CancellationToken ct)
    {
        if (await db.Opportunities.IgnoreQueryFilters().AnyAsync(ct)) return;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var rng = new Random(20260609);
        var team = new[] { "Mitchell Admin", "Marc Demo", "Priya Sharma" };
        var customers = new[] { "Deco Addict", "Ready Mat", "Gemini Furniture", "Azure Interior", "The Jackson Group", "Lumber Inc", "Wood Corner" };

        // ── Product catalog ──
        var products = new (string Code, string Name, string Category, decimal Price, decimal Stock)[]
        {
            ("FURN_0096", "Customizable Desk", "Furniture", 750.00m, 45),
            ("FURN_6741", "Large Meeting Table", "Furniture", 4000.00m, 8),
            ("FURN_0269", "Office Chair Black", "Furniture", 120.50m, 80),
            ("FURN_0789", "Individual Workplace", "Furniture", 885.00m, 16),
            ("FURN_0009", "Wall Shelf Unit", "Furniture", 198.00m, 24),
            ("FURN_7800", "Four Person Desk", "Furniture", 2350.00m, 12),
            ("DESK_0001", "Standing Desk Pro", "Furniture", 1299.00m, 20),
            ("CARP_0150", "Premium Carpet (per sq.m)", "Flooring", 280.00m, 500),
            ("SERV_0001", "Interior Design Consulting", "Services", 1500.00m, 0),
            ("SERV_0002", "On-site Installation", "Services", 600.00m, 0),
            ("SOFT_0001", "Annual Support Plan", "Software", 2400.00m, 0),
            ("DELI_0010", "Local Delivery", "Logistics", 0.00m, 0)
        };
        foreach (var p in products)
            db.Products.Add(Product.Create(DemoTenant, p.Code, p.Name, p.Price, p.Category, 15m, p.Stock, p.Category == "Services" || p.Category == "Software" ? "Units" : "Units", null, "seed"));

        // ── CRM opportunities across the pipeline ──
        var defs = new (string Name, SalesStage Stage, decimal Rev, int Pri, string[] Tags, int CloseIn)[]
        {
            ("Office Design Project",            SalesStage.New,         24000, 2, new[]{"Design"},               25),
            ("Quote for 150 carpets",           SalesStage.New,         40000, 1, new[]{"Product"},              18),
            ("Modern Open Space",               SalesStage.New,         4500,  1, new[]{"Design"},               30),
            ("Interest in your products",       SalesStage.Qualified,   2000,  2, new[]{"Product","Information"},14),
            ("DeltaPC: 10 Computer Desks",      SalesStage.Qualified,   35000, 1, new[]{"Information","Training"},20),
            ("Need 20 Desks",                   SalesStage.Qualified,   60000, 0, new[]{"Product","Consulting"}, 22),
            ("Open Space Design",               SalesStage.Proposition, 11000, 2, new[]{"Design"},               12),
            ("Office Design and Architecture",  SalesStage.Proposition, 9000,  2, new[]{"Design","Consulting"},  10),
            ("5 VP Chairs",                     SalesStage.Proposition, 5600,  1, new[]{"Product"},              8),
            ("Customizable Desk (15 units)",    SalesStage.Proposition, 15000, 1, new[]{"Product"},              16),
            ("Distributor Contract",            SalesStage.Won,         19800, 3, new[]{"Information"},          -3),
            ("Access to Online Catalog",        SalesStage.Won,         2000,  1, new[]{"Services"},             -8),
            ("Global Solutions: Furnitures",    SalesStage.Won,         3800,  2, new[]{"Design"},               -5),
            ("Warehouse Racking",               SalesStage.Lost,        12000, 0, new[]{"Product"},              -1)
        };
        var n = 1000;
        var opps = new List<Opportunity>();
        foreach (var d in defs)
        {
            n++;
            var contact = customers[rng.Next(customers.Length)];
            var o = Opportunity.Create(DemoTenant, $"OPP-{n}", d.Name, contact, d.Stage, d.Rev, null, d.Pri,
                $"{contact} Buyer", $"buyer@{contact.Replace(" ", "").ToLowerInvariant()}.com", $"+91 9{rng.Next(100000000, 999999999)}",
                team[rng.Next(team.Length)], today.AddDays(d.CloseIn), "Website", null, d.Tags, "seed");
            // Schedule a follow-up on a couple of open ones.
            if (d.Stage is SalesStage.Qualified or SalesStage.Proposition && rng.Next(2) == 0)
                o.AddActivity(rng.Next(2) == 0 ? "call" : "meeting", "Call to get system requirements", today.AddDays(rng.Next(1, 4)), "seed");
            opps.Add(o);
        }
        db.Opportunities.AddRange(opps);

        // ── Quotations / sales orders ──
        var qn = 0;
        var quotePlan = new (string Customer, QuotationStatus Status, (string Code, string Name, decimal Qty, decimal Price)[] Lines)[]
        {
            ("Deco Addict", QuotationStatus.SalesOrder, new[]{ ("FURN_6741","Large Meeting Table",1m,4000m), ("DELI_0010","Local Delivery",1m,0m) }),
            ("Ready Mat", QuotationStatus.Sent, new[]{ ("FURN_0096","Customizable Desk",10m,750m), ("SERV_0002","On-site Installation",1m,600m) }),
            ("Gemini Furniture", QuotationStatus.Quotation, new[]{ ("FURN_0269","Office Chair Black",5m,120.50m) }),
            ("Azure Interior", QuotationStatus.Quotation, new[]{ ("FURN_0096","Customizable Desk",15m,750m) }),
            ("The Jackson Group", QuotationStatus.SalesOrder, new[]{ ("CARP_0150","Premium Carpet (per sq.m)",150m,280m), ("SERV_0001","Interior Design Consulting",1m,1500m) }),
            ("Lumber Inc", QuotationStatus.Sent, new[]{ ("FURN_7800","Four Person Desk",3m,2350m) }),
            ("Wood Corner", QuotationStatus.Quotation, new[]{ ("DESK_0001","Standing Desk Pro",4m,1299m), ("FURN_0009","Wall Shelf Unit",6m,198m) })
        };
        foreach (var p in quotePlan)
        {
            qn++;
            var lines = p.Lines.Select(l => new QuotationLine { ProductCode = l.Code, Product = l.Name, Quantity = l.Qty, UnitPrice = l.Price, TaxPercent = 15m }).ToList();
            var order = today.AddDays(-rng.Next(2, 30));
            db.Quotations.Add(Quotation.Create(DemoTenant, $"S{qn:00000}", p.Customer, order, p.Status,
                order.AddDays(15), $"contact@{p.Customer.Replace(" ", "").ToLowerInvariant()}.com", null, "INR", "30 Days",
                team[rng.Next(team.Length)], null, null, lines, "seed"));
        }

        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedSupplyChainAsync(YugmaDbContext db, CancellationToken ct)
    {
        if (await db.StockItems.IgnoreQueryFilters().AnyAsync(ct)) return;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var rng = new Random(20260610);
        var team = new[] { "Marc Demo", "Mitchell Admin", "Joel Willis", "Lucia Garcia" };

        // ── Inventory: stock items ──
        var items = new (string Sku, string Name, string Cat, decimal OnHand, decimal Reserved, decimal Reorder, decimal Cost)[]
        {
            ("FURN_0096", "Customizable Desk", "Furniture", 45, 6, 20, 520),
            ("FURN_6741", "Large Meeting Table", "Furniture", 8, 1, 5, 2800),
            ("FURN_0269", "Office Chair Black", "Furniture", 80, 12, 30, 78),
            ("FURN_7800", "Four Person Desk", "Furniture", 12, 3, 6, 1650),
            ("COMP_0001", "Table Top (Oak)", "Components", 120, 40, 50, 95),
            ("COMP_0002", "Steel Leg Set", "Components", 200, 60, 80, 32),
            ("COMP_0003", "Chair Frame", "Components", 150, 20, 60, 41),
            ("COMP_0004", "Castor Wheel", "Components", 600, 120, 200, 4.5m),
            ("RAW_0001", "Plywood Sheet 18mm", "Raw Material", 14, 0, 30, 56),
            ("RAW_0002", "Foam Padding (roll)", "Raw Material", 9, 0, 20, 88),
            ("CARP_0150", "Premium Carpet (sq.m)", "Flooring", 500, 150, 200, 180),
            ("PACK_0001", "Carton Box (large)", "Packaging", 350, 0, 100, 12)
        };
        foreach (var i in items)
            db.StockItems.Add(StockItem.Create(DemoTenant, i.Sku, i.Name, i.Cat, "WH/Stock", i.OnHand, i.Reserved, i.Reorder, i.Cost, "Units", "seed"));

        // ── Inventory: stock moves (transfers) ──
        var mn = 0;
        var moves = new (StockMoveType Type, string Product, decimal Qty, StockMoveStatus St, string Partner, int Days)[]
        {
            (StockMoveType.Receipt, "Plywood Sheet 18mm", 100, StockMoveStatus.Ready, "Lumber Inc", 1),
            (StockMoveType.Receipt, "Steel Leg Set", 200, StockMoveStatus.Done, "MetalWorks Ltd", -2),
            (StockMoveType.Receipt, "Foam Padding (roll)", 40, StockMoveStatus.Draft, "Comfort Supplies", 3),
            (StockMoveType.Delivery, "Customizable Desk", 10, StockMoveStatus.Ready, "Deco Addict", 0),
            (StockMoveType.Delivery, "Office Chair Black", 20, StockMoveStatus.Done, "Ready Mat", -1),
            (StockMoveType.Delivery, "Large Meeting Table", 1, StockMoveStatus.Draft, "Gemini Furniture", 2),
            (StockMoveType.Internal, "Table Top (Oak)", 30, StockMoveStatus.Ready, "WH/Assembly", 0),
            (StockMoveType.Internal, "Chair Frame", 25, StockMoveStatus.Draft, "WH/Assembly", 1)
        };
        foreach (var m in moves)
        {
            mn++;
            var prefix = m.Type switch { StockMoveType.Receipt => "WH/IN/", StockMoveType.Delivery => "WH/OUT/", _ => "WH/INT/" };
            var (src, dst) = m.Type switch { StockMoveType.Receipt => (m.Partner, "WH/Stock"), StockMoveType.Delivery => ("WH/Stock", m.Partner), _ => ("WH/Stock", m.Partner) };
            db.StockMoves.Add(StockMove.Create(DemoTenant, $"{prefix}{mn:00000}", m.Type, m.Product, m.Qty, src, dst, today.AddDays(m.Days), m.St,
                m.Type == StockMoveType.Internal ? null : m.Partner, "seed"));
        }

        // ── Manufacturing orders ──
        var mon = 0;
        var mos = new (string Product, decimal Qty, ManufacturingStage Stage, (string P, decimal Q)[] Comp, int Days)[]
        {
            ("Customizable Desk", 10, ManufacturingStage.Confirmed, new[]{ ("Table Top (Oak)",10m), ("Steel Leg Set",10m) }, 3),
            ("Office Chair Black", 25, ManufacturingStage.InProgress, new[]{ ("Chair Frame",25m), ("Castor Wheel",125m), ("Foam Padding (roll)",3m) }, 1),
            ("Four Person Desk", 4, ManufacturingStage.Draft, new[]{ ("Table Top (Oak)",8m), ("Steel Leg Set",8m) }, 7),
            ("Large Meeting Table", 2, ManufacturingStage.Done, new[]{ ("Plywood Sheet 18mm",6m), ("Steel Leg Set",4m) }, -4),
            ("Customizable Desk", 15, ManufacturingStage.Confirmed, new[]{ ("Table Top (Oak)",15m), ("Steel Leg Set",15m) }, 5)
        };
        foreach (var m in mos)
        {
            mon++;
            var comps = m.Comp.Select(c => new BomComponent { Product = c.P, Quantity = c.Q, Uom = "Units", Consumed = m.Stage == ManufacturingStage.Done }).ToList();
            db.ManufacturingOrders.Add(ManufacturingOrder.Create(DemoTenant, $"MO/{mon:00000}", m.Product, m.Qty, today.AddDays(m.Days), m.Stage, "Units", team[rng.Next(team.Length)], null, comps, "seed"));
        }

        // ── PLM: engineering change orders ──
        var en = 0;
        var ecos = new (string Title, string Product, EcoType Type, EcoStage Stage, int Pri)[]
        {
            ("Switch desk legs to powder-coated steel", "Customizable Desk", EcoType.BillOfMaterials, EcoStage.InProgress, 2),
            ("New ergonomic chair frame revision", "Office Chair Black", EcoType.ProductDesign, EcoStage.New, 1),
            ("Update assembly routing for meeting table", "Large Meeting Table", EcoType.Routing, EcoStage.Approved, 1),
            ("Add sustainability spec sheet", "Four Person Desk", EcoType.Documentation, EcoStage.Done, 0),
            ("Reduce foam thickness to cut cost", "Office Chair Black", EcoType.BillOfMaterials, EcoStage.New, 3)
        };
        foreach (var e in ecos)
        {
            en++;
            db.EngineeringChanges.Add(EngineeringChange.Create(DemoTenant, $"ECO/{en:00000}", e.Title, e.Product, e.Type, e.Stage, e.Pri,
                team[rng.Next(team.Length)], "Proposed change pending engineering review and approval.", e.Stage == EcoStage.Approved ? today.AddDays(7) : null, "seed"));
        }

        // ── Purchase orders ──
        var pn = 0;
        var pos = new (string Vendor, PurchaseStatus Status, (string P, decimal Q, decimal Price)[] Lines, int Days)[]
        {
            ("Lumber Inc", PurchaseStatus.Purchase, new[]{ ("Plywood Sheet 18mm",100m,56m), ("Table Top (Oak)",50m,95m) }, -5),
            ("MetalWorks Ltd", PurchaseStatus.Sent, new[]{ ("Steel Leg Set",200m,32m), ("Chair Frame",60m,41m) }, -2),
            ("Comfort Supplies", PurchaseStatus.Rfq, new[]{ ("Foam Padding (roll)",40m,88m) }, 1),
            ("Castor World", PurchaseStatus.Received, new[]{ ("Castor Wheel",500m,4.5m) }, -10),
            ("PackRight Co", PurchaseStatus.Rfq, new[]{ ("Carton Box (large)",300m,12m) }, 3)
        };
        foreach (var p in pos)
        {
            pn++;
            var lines = p.Lines.Select(l => new PurchaseLine { Product = l.P, Quantity = l.Q, UnitPrice = l.Price, TaxPercent = 18m }).ToList();
            var order = today.AddDays(p.Days);
            db.PurchaseOrders.Add(PurchaseOrder.Create(DemoTenant, $"P{pn:00000}", p.Vendor, order, p.Status, order.AddDays(7),
                $"orders@{p.Vendor.Replace(" ", "").ToLowerInvariant()}.com", team[rng.Next(team.Length)], null, lines, "seed"));
        }

        // ── Maintenance requests ──
        var mrn = 0;
        var mrs = new (string Title, string Equip, MaintenanceKind Kind, MaintenanceStage Stage, int Pri, decimal Hrs)[]
        {
            ("CNC router spindle noise", "CNC Router #1", MaintenanceKind.Corrective, MaintenanceStage.InProgress, 3, 4),
            ("Quarterly forklift service", "Forklift FL-02", MaintenanceKind.Preventive, MaintenanceStage.New, 1, 2),
            ("Replace conveyor belt", "Assembly Conveyor", MaintenanceKind.Corrective, MaintenanceStage.New, 2, 6),
            ("Calibrate paint booth sensors", "Paint Booth A", MaintenanceKind.Preventive, MaintenanceStage.Repaired, 1, 3),
            ("Compressor oil change", "Air Compressor #3", MaintenanceKind.Preventive, MaintenanceStage.Repaired, 0, 1.5m),
            ("Saw blade guard damaged", "Panel Saw PS-1", MaintenanceKind.Corrective, MaintenanceStage.Scrap, 2, 0)
        };
        foreach (var m in mrs)
        {
            mrn++;
            db.MaintenanceRequests.Add(MaintenanceRequest.Create(DemoTenant, $"MR/{mrn:00000}", m.Title, m.Equip, m.Kind, m.Stage, m.Pri,
                team[rng.Next(team.Length)], m.Kind == MaintenanceKind.Preventive ? "Scheduled" : "Breakdown", today.AddDays(rng.Next(-3, 8)), m.Hrs,
                "Reported via shop-floor maintenance terminal.", "seed"));
        }

        // ── Quality checks ──
        var qn = 0;
        var qcs = new (string Title, string Product, QualityCheckType Type, QualityStatus Status, string Point)[]
        {
            ("Incoming plywood moisture check", "Plywood Sheet 18mm", QualityCheckType.Measure, QualityStatus.Pass, "Receipt"),
            ("Desk surface finish inspection", "Customizable Desk", QualityCheckType.PassFail, QualityStatus.ToDo, "Final Inspection"),
            ("Chair load test (120kg)", "Office Chair Black", QualityCheckType.PassFail, QualityStatus.Pass, "Final Inspection"),
            ("Steel leg coating thickness", "Steel Leg Set", QualityCheckType.Measure, QualityStatus.Fail, "Receipt"),
            ("Meeting table alignment", "Large Meeting Table", QualityCheckType.Instructions, QualityStatus.ToDo, "In-Process"),
            ("Carton drop test", "Carton Box (large)", QualityCheckType.PassFail, QualityStatus.Pass, "Packaging")
        };
        foreach (var c in qcs)
        {
            qn++;
            db.QualityChecks.Add(QualityCheck.Create(DemoTenant, $"QC/{qn:00000}", c.Title, c.Product, c.Type, c.Point, c.Status,
                $"WH/IN/{rng.Next(1, 5):00000}", team[rng.Next(team.Length)], c.Type == QualityCheckType.Measure ? "Tolerance ±0.5mm" : null,
                c.Status == QualityStatus.Fail ? "Out of tolerance — quarantined and returned to vendor." : null, "seed"));
        }

        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedFinanceAsync(YugmaDbContext db, CancellationToken ct)
    {
        if (await db.FinanceDocuments.IgnoreQueryFilters().AnyAsync(ct)) return;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var rng = new Random(20260608);

        var customers = new[] { "Deco Addict", "Ready Mat", "Gemini Furniture", "Azure Interior", "The Jackson Group", "Lumber Inc" };
        var vendors = new[] { "Office Supplies Co", "Cloud Hosting Ltd", "Logistics Partners", "Print Works", "Power & Utilities", "Staffing Solutions" };

        var docs = new List<FinanceDocument>();
        var invNo = 1000; var billNo = 1000;

        // Customer invoices — a realistic spread of draft / paid / open / overdue.
        (FinanceDocStatus Status, int IssueAgo, int DueIn)[] invPlan =
        {
            (FinanceDocStatus.Draft, 2, 28), (FinanceDocStatus.Draft, 1, 29),
            (FinanceDocStatus.Posted, 40, -10), (FinanceDocStatus.Posted, 55, -25), (FinanceDocStatus.Posted, 35, -5),  // overdue
            (FinanceDocStatus.Posted, 8, 22), (FinanceDocStatus.Posted, 15, 15), (FinanceDocStatus.Posted, 20, 40),     // open, not due
            (FinanceDocStatus.Paid, 60, -30), (FinanceDocStatus.Paid, 45, -15), (FinanceDocStatus.Paid, 25, 5)
        };
        foreach (var p in invPlan)
        {
            invNo++;
            var amount = Math.Round((decimal)(20000 + rng.Next(0, 260000)), 0);
            var issue = today.AddDays(-p.IssueAgo);
            docs.Add(FinanceDocument.Create(DemoTenant, $"INV-{invNo}", FinanceDocKind.CustomerInvoice,
                customers[rng.Next(customers.Length)], issue, issue.AddDays(p.DueIn + p.IssueAgo),
                amount, Math.Round(amount * 0.18m, 0), p.Status, 0, $"SO-{rng.Next(70, 99)}", null, "seed"));
        }

        // Vendor bills.
        (FinanceDocStatus Status, int IssueAgo, int DueIn)[] billPlan =
        {
            (FinanceDocStatus.Draft, 1, 30),
            (FinanceDocStatus.Posted, 30, -4), (FinanceDocStatus.Posted, 12, 18), (FinanceDocStatus.Posted, 20, 10),
            (FinanceDocStatus.Posted, 5, 25), (FinanceDocStatus.Paid, 40, -10), (FinanceDocStatus.Paid, 22, 8)
        };
        foreach (var p in billPlan)
        {
            billNo++;
            var amount = Math.Round((decimal)(8000 + rng.Next(0, 90000)), 0);
            var issue = today.AddDays(-p.IssueAgo);
            docs.Add(FinanceDocument.Create(DemoTenant, $"BILL-{billNo}", FinanceDocKind.VendorBill,
                vendors[rng.Next(vendors.Length)], issue, issue.AddDays(p.DueIn + p.IssueAgo),
                amount, Math.Round(amount * 0.18m, 0), p.Status, 0, null, null, "seed"));
        }
        db.FinanceDocuments.AddRange(docs);

        // Bank + cash accounts with statement lines.
        var bank = BankAccount.Create(DemoTenant, "HDFC Current A/C", BankAccountKind.Bank, 850000m, "INR", "seed");
        var cash = BankAccount.Create(DemoTenant, "Petty Cash", BankAccountKind.Cash, 25000m, "INR", "seed");
        db.BankAccounts.AddRange(bank, cash);

        var labels = new[] { "Customer payment", "Vendor payment", "Bank charges", "Salary transfer", "Refund", "Office rent", "Interest credit" };
        for (var i = 0; i < 16; i++)
        {
            var date = today.AddDays(-rng.Next(0, 40));
            var inflow = rng.NextDouble() < 0.5;
            var amount = Math.Round((decimal)(inflow ? 20000 + rng.Next(0, 180000) : -(8000 + rng.Next(0, 90000))), 0);
            var cat = i % 3 == 0 ? "payment" : (i % 3 == 1 ? "misc" : "transfer");
            db.BankTransactions.Add(BankTransaction.Create(DemoTenant, bank.Id, date, labels[rng.Next(labels.Length)], amount, cat, rng.NextDouble() < 0.5, "seed"));
        }
        for (var i = 0; i < 6; i++)
        {
            var date = today.AddDays(-rng.Next(0, 25));
            var amount = Math.Round((decimal)(rng.NextDouble() < 0.5 ? 2000 + rng.Next(0, 12000) : -(1000 + rng.Next(0, 8000))), 0);
            db.BankTransactions.Add(BankTransaction.Create(DemoTenant, cash.Id, date, i % 2 == 0 ? "Cash receipt" : "Cash expense", amount, "misc", rng.NextDouble() < 0.6, "seed"));
        }

        // Expenses across the approval flow.
        var employees = new[] { "Devansh Patel", "Priya Sharma", "Ananya Rao", "Karthik Nair", "Rahul Mehta" };
        var categories = new[] { "Travel", "Meals", "Accommodation", "Software", "Office supplies", "Client entertainment" };
        (ExpenseStatus Status, int DaysAgo)[] expPlan =
        {
            (ExpenseStatus.Submitted, 2), (ExpenseStatus.Submitted, 4), (ExpenseStatus.Submitted, 1),
            (ExpenseStatus.Approved, 8), (ExpenseStatus.Approved, 12),
            (ExpenseStatus.Reimbursed, 25), (ExpenseStatus.Reimbursed, 30),
            (ExpenseStatus.Draft, 0), (ExpenseStatus.Refused, 15)
        };
        var expNo = 1000;
        foreach (var p in expPlan)
        {
            expNo++;
            var cat = categories[rng.Next(categories.Length)];
            db.Expenses.Add(Expense.Create(DemoTenant, $"EXP-{expNo}", employees[rng.Next(employees.Length)], cat,
                $"{cat} expense", today.AddDays(-p.DaysAgo), Math.Round((decimal)(800 + rng.Next(0, 24000)), 0), p.Status, "seed"));
        }

        // Documents + a few awaiting signature.
        (string Name, string Category, SignatureStatus Sig, string? Signer)[] files =
        {
            ("Master Services Agreement — Deco Addict.pdf", "Contract", SignatureStatus.Pending, "Deco Addict"),
            ("NDA — Gemini Furniture.pdf", "Contract", SignatureStatus.Pending, "Gemini Furniture"),
            ("Vendor Agreement — Cloud Hosting Ltd.pdf", "Contract", SignatureStatus.Signed, "Cloud Hosting Ltd"),
            ("GST Filing — Q1.pdf", "Tax", SignatureStatus.None, null),
            ("Bank Statement — March.pdf", "Statement", SignatureStatus.None, null),
            ("Annual Audit Report.pdf", "Report", SignatureStatus.None, null),
            ("Invoice INV-1004.pdf", "Invoice", SignatureStatus.None, null),
            ("Lease Renewal — HQ.pdf", "Contract", SignatureStatus.Pending, "Azure Interior")
        };
        foreach (var f in files)
            db.FinanceFiles.Add(FinanceFile.Create(DemoTenant, f.Name, f.Category, "Nisha Agarwal", f.Sig, f.Signer,
                f.Sig == SignatureStatus.Signed ? DateTime.UtcNow.AddDays(-5) : null, "seed"));

        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedAppUsersAsync(YugmaDbContext db, CancellationToken ct)
    {
        var now = DateTime.UtcNow;

        // Profile metadata (job title + department) keyed by email — used for both insert and backfill.
        var profiles = new Dictionary<string, (string Title, string Dept)>
        {
            ["priya@yugma.io"]   = ("Chief Executive Officer", "Executive"),
            ["rohan@yugma.io"]   = ("Head of IT & Security",   "Information Technology"),
            ["sneha@yugma.io"]   = ("Engineering Manager",     "Engineering"),
            ["karthik@yugma.io"] = ("Sales Associate",         "Sales"),
            ["meera@yugma.io"]   = ("HR Business Partner",      "Human Resources"),
            ["arjun@yugma.io"]   = ("Senior Accountant",       "Finance"),
            ["divya@yugma.io"]   = ("Product Designer",        "Design"),
            ["vikram@yugma.io"]  = ("Solutions Architect",     "Engineering")
        };

        if (!await db.AppUsers.IgnoreQueryFilters().AnyAsync(ct))
        {
            void Add(string name, string email, string role, bool mfa, DateTime? login, UserStatus status)
            {
                var u = AppUser.Create(DemoTenant, name, email, role, mfa, login, status);
                if (profiles.TryGetValue(email, out var p)) { u.JobTitle = p.Title; u.Department = p.Dept; }
                if (status == UserStatus.Pending) u.InvitedAt = now.AddDays(-1);
                db.AppUsers.Add(u);
            }

            Add("Priya Sharma",   "priya@yugma.io",   "Owner",   true,  now.AddMinutes(-2), UserStatus.Active);
            Add("Rohan Mehta",    "rohan@yugma.io",   "Admin",   true,  now.AddHours(-1),   UserStatus.Active);
            Add("Sneha Iyer",     "sneha@yugma.io",   "Manager", false, now.AddDays(-3),    UserStatus.Active);
            Add("Karthik Nair",   "karthik@yugma.io", "Member",  true,  now.AddDays(-8),    UserStatus.Inactive);
            Add("Meera Krishnan", "meera@yugma.io",   "Admin",   true,  now.AddHours(-5),   UserStatus.Active);
            Add("Arjun Reddy",    "arjun@yugma.io",   "Member",  false, now.AddDays(-1),    UserStatus.Active);
            Add("Divya Menon",    "divya@yugma.io",   "Member",  true,  null,               UserStatus.Pending);
            Add("Vikram Singh",   "vikram@yugma.io",  "Manager", false, now.AddDays(-21),   UserStatus.Suspended);

            await db.SaveChangesAsync(ct);
        }

        var existing = await db.AppUsers.IgnoreQueryFilters().ToListAsync(ct);
        var byEmail = existing.ToDictionary(u => u.Email, StringComparer.OrdinalIgnoreCase);

        // Ensure the generic, ACTIVE persona logins exist so each access level can be tested.
        // Note: hr@ has the plain "Member" role but sits in the Human Resources department — it demonstrates
        // DEPARTMENT-based access (HR can manage the directory even without an admin role).
        var personas = new (string Name, string Email, string Role, string Title, string Dept)[]
        {
            ("Olivia Owner",      "owner@yugma.io",      "Owner",   "Founder & CEO",          "Executive"),
            ("Aditya Admin",      "admin@yugma.io",      "Admin",   "IT Administrator",       "Information Technology"),
            ("Maya Manager",      "manager@yugma.io",    "Manager", "Engineering Manager",    "Engineering"),
            ("Hema Reddy",        "hr@yugma.io",         "Member",  "HR Manager",             "Human Resources"),
            ("Aaron Associate",   "associate@yugma.io",  "Member",  "Associate Engineer",     "Engineering"),
            // HR department logins (employee records + reporting chain seeded by SeedHrDepartmentAsync).
            ("Vivaan Kapoor",     "hr.vp@yugma.io",      "Manager", "VP, Human Resources",    "Human Resources"),
            ("Sameer Rao",        "hr.srmgr@yugma.io",   "Manager", "Senior HR Manager",      "Human Resources"),
            ("Leena Pillai",      "hr.mgr@yugma.io",     "Manager", "HR Manager",             "Human Resources"),
            ("Ishan Mehta",       "hr.assoc1@yugma.io",  "Member",  "HR Associate",           "Human Resources"),
            ("Tara Singh",        "hr.assoc2@yugma.io",  "Member",  "HR Associate",           "Human Resources"),
            // Services department logins — these carry the "services" role (department-based access to the Services module).
            ("Sahil Verma",       "service.manager@yugma.io", "Manager", "Services Delivery Manager", "Services"),
            ("Rohit Sharma",      "service.tech@yugma.io",    "Member",  "Field Service Technician", "Services"),
            ("Anjali Gupta",      "service.agent@yugma.io",   "Member",  "Helpdesk Agent",           "Services"),
            // Finance department logins — these carry the "finance" role (department-based access to the Finance module).
            ("Nisha Agarwal",     "finance.manager@yugma.io",    "Manager", "Finance Controller", "Finance"),
            ("Rahul Mehta",       "finance.accountant@yugma.io", "Member",  "Senior Accountant",  "Finance"),
            // Sales department logins — these carry the "sales" role (department-based access to the Sales/CRM module).
            ("Mitchell Admin",    "sales.manager@yugma.io",      "Manager", "Sales Manager",      "Sales"),
            ("Marc Demo",         "sales.rep@yugma.io",          "Member",  "Sales Representative","Sales"),
            // Supply Chain department logins — these carry the "supplychain" role (Inventory/Manufacturing/PLM/Purchase/Maintenance/Quality).
            ("Joel Willis",       "supply.manager@yugma.io",     "Manager", "Supply Chain Manager","Supply Chain"),
            ("Lucia Garcia",      "supply.operator@yugma.io",    "Member",  "Warehouse Operator",  "Supply Chain")
        };
        foreach (var p in personas)
        {
            if (byEmail.ContainsKey(p.Email)) continue;
            var u = AppUser.Create(DemoTenant, p.Name, p.Email, p.Role, false, now.AddDays(-1), UserStatus.Active);
            u.JobTitle = p.Title; u.Department = p.Dept;
            db.AppUsers.Add(u);
            existing.Add(u);
        }

        // Idempotent backfill: job title/department (legacy rows) + password hash (all rows).
        foreach (var u in existing)
        {
            if (string.IsNullOrWhiteSpace(u.JobTitle) && profiles.TryGetValue(u.Email, out var pr))
            { u.JobTitle = pr.Title; u.Department = pr.Dept; }
            if (string.IsNullOrWhiteSpace(u.PasswordHash))
                u.SetPasswordHash(PasswordHasher.Hash(DemoPassword), "seed");
        }
        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedSubscriptionsAsync(YugmaDbContext db, CancellationToken ct)
    {
        if (await db.ModuleSubscriptions.IgnoreQueryFilters().AnyAsync(ct)) return;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var renews = today.AddMonths(1);
        db.ModuleSubscriptions.AddRange(
            ModuleSubscription.Create(
                DemoTenant, "hr", "HR Management",
                "Employees, attendance, leave, payroll, recruitment and performance reviews.",
                "pi-users", "growth", "active", 24_999m, "monthly",
                seats: 250, seatsUsed: 184, startedAt: today.AddMonths(-7), renewsAt: renews,
                features: new[] { "Org chart & roles", "Attendance & leave workflows", "Payroll runs", "Performance reviews", "Recruitment pipeline" }),
            ModuleSubscription.Create(
                DemoTenant, "accounts", "Accounts & Finance",
                "Invoicing, GST, ledger, receivables, vendor payments and financial reports.",
                "pi-wallet", "enterprise", "active", 39_999m, "annual",
                seats: 60, seatsUsed: 42, startedAt: today.AddMonths(-11), renewsAt: today.AddMonths(1),
                features: new[] { "GST-ready invoicing", "Receivables & aging", "Multi-currency ledger", "Tally export", "Approval workflows" }),
            ModuleSubscription.Create(
                DemoTenant, "material", "Material Management",
                "Inventory, multi-warehouse stock, purchase orders, vendors and reorder rules.",
                "pi-box", "starter", "trialing", 9_999m, "monthly",
                seats: 25, seatsUsed: 8, startedAt: today.AddDays(-10), renewsAt: today.AddDays(20),
                features: new[] { "Multi-warehouse inventory", "PO lifecycle", "Vendor catalog", "Reorder alerts" })
        );
        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedAgentsAsync(YugmaDbContext db, CancellationToken ct)
    {
        // Only add agents that don't exist yet — preserves any model/enabled config the
        // admin has changed for existing agents.
        var existingKeys = await db.HrAgents.IgnoreQueryFilters().Select(a => a.Key).ToHashSetAsync(ct);

        // (key, stage, name, tagline, description, icon, model, capability)
        var seed = new (string K, string S, string N, string T, string D, string Icon, string Model, string Cap)[]
        {
            // ===== Orchestrators (multi-agent) =====
            ("recruitment.pipeline",    "recruitment", "Recruitment Pipeline",     "Orchestrator: JD → resume ranking → screening, end-to-end.",               "Calls JD Generator → Resume Ranker → Screening Bot in sequence and composes a single result.", "pi-sitemap","gpt-5","Orchestrator"),
            ("onboarding.orchestrator", "onboarding",  "Onboarding Orchestrator",  "Orchestrator: doc extract → 30-60-90 plan → buddy match.",                 "Calls Doc Auto-Extract → Personalised Plan → Buddy Matcher and produces an onboarding kit.",  "pi-sitemap","gpt-5","Orchestrator"),
            ("confirmation.decision",   "confirmation","Confirmation Decision",    "Orchestrator: feedback synth + probation score → confirm/extend.",          "Calls Feedback Synthesiser → Probation Scorer to produce a calibrated recommendation.",        "pi-sitemap","gpt-5","Orchestrator"),
            ("separation.action_plan",  "separation",  "Separation Action Plan",   "Orchestrator: attrition risk + retention nudges in one call.",              "Calls Attrition Predictor → Retention Nudger and packages a complete action plan.",            "pi-sitemap","gpt-5","Orchestrator"),

            // 1. Recruitment
            ("recruitment.jd_generator",  "recruitment", "JD Generator",        "Drafts compelling, inclusive job descriptions from a role brief.",            "Crafts job descriptions in the Yugma voice with inclusive language and structured must/nice-to-haves.", "pi-pencil",       "gpt-5",        "Drafting"),
            ("recruitment.resume_ranker", "recruitment", "Resume Ranker",       "Ranks inbound resumes against the JD with explainable scores.",                "Uses embeddings + GPT-5 evals to rank resumes against JD, surfaces top N with rationale + bias check.", "pi-sort-amount-down","gpt-5",      "Ranking"),
            ("recruitment.screening_bot", "recruitment", "Screening Bot",       "Conversational pre-screen over chat / WhatsApp with structured outputs.",     "Auto-replies to inbound applicants, conducts a 6-question pre-screen, and routes qualified leads to recruiters.", "pi-comments","gpt-5",         "Conversational"),

            // 2. Offer
            ("offer.salary_benchmark",    "offer",       "Salary Benchmark",    "Real-time market band for role + city + experience level.",                   "Synthesises Mercer, Aon, Levels.fyi and internal salary bands to suggest p25-p75-p90.", "pi-chart-bar",  "gpt-5",        "Benchmarking"),
            ("offer.accept_prediction",   "offer",       "Accept Predictor",    "Predicts offer-acceptance likelihood and recommends levers.",                  "ML + GPT-5 ensemble that returns likelihood and the top levers to move it (comp, ESOP, start date).", "pi-check-square","gpt-5",        "Forecasting"),
            ("offer.bgv_summary",         "offer",       "BGV Summary",         "Turns a 40-page background check into a 5-bullet summary.",                    "Distils third-party BGV reports into red/amber/green with citations to specific pages.", "pi-shield",       "gpt-5",        "Summarisation"),

            // 3. Onboarding
            ("onboarding.doc_extract",    "onboarding",  "Doc Auto-Extract",    "OCR + GPT-5 on Aadhaar / PAN / offer letter — autofills the profile.",         "Multi-modal pipeline: OCR → field extraction → validation → autofill into employee record.", "pi-file",       "gpt-5-vision", "Extraction"),
            ("onboarding.plan",           "onboarding",  "Personalised Plan",   "Generates a tailored 30-60-90 onboarding plan for the new hire.",              "Combines role, level, manager style and team rituals to draft a personalised 30-60-90 with concrete tasks.", "pi-list-check","gpt-5",     "Planning"),
            ("onboarding.buddy_match",    "onboarding",  "Buddy Matcher",       "Finds the best onboarding buddy by interests, calendar and overlap.",          "Vector-similarity over skills, interests, calendar density and Slack tone to suggest the top buddy.", "pi-users",     "embedding",    "Matching"),

            // 4. Confirmation
            ("confirmation.probation",    "confirmation","Probation Scorer",    "Multi-source probation score with confirm / extend / part-ways recommendation.","Aggregates manager + peer feedback, deliverable metrics and 1:1 notes into a calibrated score.", "pi-star",         "gpt-5",        "Scoring"),
            ("confirmation.feedback",     "confirmation","Feedback Synthesiser","Compresses 8+ feedback notes into a clear 1-page review draft.",               "Reads all 360 feedback, removes redundancy, preserves verbatims, drafts the manager's review.", "pi-align-left",   "gpt-5",        "Summarisation"),

            // 5. Active employment
            ("active.attendance",         "active",      "Attendance AI",       "Detects punch anomalies, suspicious shifts and burnout signals.",              "Anomaly detector over badge data + Slack activity + 1:1 cadence to flag risks.", "pi-clock",       "gpt-5",        "Anomaly detect"),
            ("active.payroll",            "active",      "Payroll AI",          "MoM payroll variance + tax-planner copilot.",                                   "Catches outliers vs prior cycles + recommends 80C / NPS allocations per employee.", "pi-money-bill",   "gpt-5",        "Anomaly checks"),
            ("active.performance",        "active",      "Performance AI",      "Drafts SMART goals + flags review-bias.",                                       "Generates goal candidates from prior reviews, surfaces leniency/severity bias across managers.", "pi-chart-line", "gpt-5",        "Drafting + bias"),
            ("active.learning",           "active",      "Learning AI",          "Skill-gap analysis + personalised learning paths.",                            "Maps current skills vs role ladder, recommends courses and internal mentors.", "pi-book",          "gpt-5",        "Recommendation"),
            ("active.copilot",            "active",      "HR Copilot Chatbot",  "Self-service Q&A grounded in your policies (RAG over HR data).",                "Retrieval-augmented over your handbook + leave policy + benefits docs. Takes actions like apply-leave.", "pi-sparkles", "gpt-5",        "Conversational"),
            ("active.engagement",         "active",      "Engagement & Sentiment","Pulse analysis, burnout signals, grievance triage.",                          "Reads survey free-text + Slack sentiment + 1:1 notes to surface burnout signals and triage grievances.", "pi-heart", "gpt-5",          "Sentiment"),

            // 6. Separation
            ("separation.attrition",      "separation",  "Attrition Predictor", "Predicts attrition risk per employee with explainable drivers.",               "Gradient-boosted + GPT-5 reasoning ensemble. Returns risk band and the top 3 drivers per case.", "pi-exclamation-triangle","gpt-5","Forecasting"),
            ("separation.retention",      "separation",  "Retention Nudger",    "Suggests next-best retention actions for at-risk employees.",                  "Plays through stretch role / bump / sabbatical / role-change options and ranks by expected lift.", "pi-bolt",  "gpt-5",        "Decisioning"),
            ("separation.exit_clusters",  "separation",  "Exit Reason Clusters","Clusters exit interviews into actionable themes.",                              "Embedding-based clustering with GPT-5 labelling. Generates a Sankey of root causes per quarter.", "pi-share-alt","embedding",  "Clustering"),

            // 7. Exit clearance
            ("exit.handover",             "exit",        "Auto Handover Doc",   "Generates a handover document from Jira + Confluence + Slack.",                "Pulls owned services, in-flight tickets, docs and contacts; produces a 5-7 page handover.", "pi-file-edit",    "gpt-5",        "Generation"),
            ("exit.ff",                   "exit",        "F&F Validator",       "Validates the Full & Final settlement and flags discrepancies.",               "Re-computes earned salary, leave encashment, notice adj and benefits clawbacks. Cross-checks against policy.", "pi-calculator","gpt-5",     "Validation"),
            ("exit.interview",            "exit",        "Exit Interview Synth","Turns a 45-min transcript into a 1-page synthesis with verbatims.",            "Distils exit interviews into themes + verbatims + recommended actions.", "pi-comment",                "gpt-5",        "Summarisation"),

            // 8. Alumni
            ("alumni.rehire",             "alumni",      "Rehire Scorer",       "Scores rehire candidates with caveats.",                                        "Combines historical perf, exit sentiment and alumni engagement to recommend rehire / stretch / pass.", "pi-undo",  "gpt-5",        "Scoring"),
            ("alumni.boomerang",          "alumni",      "Boomerang Predictor", "Predicts which alumni are likely to return — and when.",                        "Predicts boomerang likelihood and likely window based on tenure, exit fit and market signals.", "pi-replay", "gpt-5",        "Forecasting"),
            ("alumni.network",            "alumni",      "Alumni Network",      "Maps alumni to companies and surfaces warm intros for biz dev.",                "Graph + embedding model over LinkedIn / alumni community to map alumni and find warm-intro paths.", "pi-globe", "gpt-5",        "Graph + intros")
        };

        var added = 0;
        foreach (var s in seed)
        {
            if (existingKeys.Contains(s.K)) continue;
            db.HrAgents.Add(HrAgent.Create(DemoTenant, s.K, s.S, s.N, s.T, s.D, s.Icon, s.Model, s.Cap));
            added++;
        }
        if (added > 0) await db.SaveChangesAsync(ct);
    }

    private static async Task SeedNotificationsAsync(YugmaDbContext db, CancellationToken ct)
    {
        if (await db.Notifications.IgnoreQueryFilters().AnyAsync(ct)) return;
        var now = DateTime.UtcNow;
        db.Notifications.AddRange(
            AppNotification.Create(DemoTenant, "Leave request pending",         "Rohan Mehta requested 3 days of casual leave starting May 20.", NotificationKind.Warn,    now.AddMinutes(-12), false, "/my-work/leave", audience: "hrManage"),
            AppNotification.Create(DemoTenant, "Invoice INV-2026-0421 paid",    "Globex Industries cleared 84,500. Receipt #RC-1187 generated.", NotificationKind.Success, now.AddMinutes(-55), false, "/accounts", audience: "admin"),
            AppNotification.Create(DemoTenant, "Low stock alert",                "SKU MAT-0192 (Hex Bolts M8) below reorder point in WH-Pune.",   NotificationKind.Danger,  now.AddHours(-2),    true,  "/material", audience: "admin"),
            AppNotification.Create(DemoTenant, "Workflow approved",              "PO #PO-7782 was approved by Finance. Vendor notified.",         NotificationKind.Info,    now.AddHours(-5),    true,  "/workflow", audience: "admin")
        );
        await db.SaveChangesAsync(ct);
    }

    // Personal, recipient-scoped notifications for the demo persona logins so each user's inbox
    // shows their own items rather than the org-wide broadcasts. Idempotent on RecipientEmail.
    private static async Task SeedPersonalNotificationsAsync(YugmaDbContext db, CancellationToken ct)
    {
        if (await db.Notifications.IgnoreQueryFilters().AnyAsync(n => n.RecipientEmail != null, ct)) return;
        var now = DateTime.UtcNow;
        db.Notifications.AddRange(
            AppNotification.Create(DemoTenant, "Leave approved",          "Your sick leave on Jun 16 was approved by Maya Manager.",            NotificationKind.Success, now.AddHours(-3),    false, "/my-requests", recipientEmail: "associate@yugma.io"),
            AppNotification.Create(DemoTenant, "Leave request submitted", "Your casual leave for Jun 10 is pending with Maya Manager.",          NotificationKind.Info,    now.AddDays(-1),     true,  "/my-requests", recipientEmail: "associate@yugma.io"),
            AppNotification.Create(DemoTenant, "Approval needed",         "Aaron Associate requested sick leave on Jun 17. Review and decide.", NotificationKind.Warn,    now.AddMinutes(-30), false, "/my-work/leave",    recipientEmail: "manager@yugma.io")
        );
        await db.SaveChangesAsync(ct);
    }
}

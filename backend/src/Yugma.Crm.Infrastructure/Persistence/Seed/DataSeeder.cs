using Yugma.Crm.Domain.Agents;
using Yugma.Crm.Domain.Audit;
using Yugma.Crm.Domain.Crm;
using Yugma.Crm.Domain.Hr;
using Yugma.Crm.Domain.Hr.Attendance;
using Yugma.Crm.Domain.Hr.Documents;
using Yugma.Crm.Domain.Hr.Leave;
using Yugma.Crm.Domain.Hr.Payroll;
using Yugma.Crm.Domain.Hr.Recruiting;
using Yugma.Crm.Domain.Hr.ValueObjects;
using Yugma.Crm.Domain.Identity;
using Yugma.Crm.Domain.Notifications;
using Yugma.Crm.Domain.Reference;
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
        await SeedPayrollAsync(db, ct);
        await SeedCandidatesAsync(db, ct);
        await SeedJobOpeningsAsync(db, ct);
        await SeedEmployeeDocumentsAsync(db, ct);
        await SeedInvoicesAsync(db, ct);
        await SeedCrmAsync(db, ct);
        await SeedAuditLogsAsync(db, ct);
        await SeedAppUsersAsync(db, ct);
        await SeedNotificationsAsync(db, ct);
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
        if (existing.Count >= 20) return;                 // already seeded with the rich pipeline
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

    private static async Task SeedCrmAsync(YugmaDbContext db, CancellationToken ct)
    {
        // 1) Pipeline stages
        if (!await db.DealStages.IgnoreQueryFilters().AnyAsync(ct))
        {
            var stages = new (string Name, int Order, int Prob, bool Won, bool Lost)[]
            {
                ("Lead", 1, 10, false, false),
                ("Qualified", 2, 30, false, false),
                ("Proposal", 3, 55, false, false),
                ("Negotiation", 4, 75, false, false),
                ("Won", 5, 100, true, false),
                ("Lost", 6, 0, false, true)
            };
            foreach (var s in stages)
                db.DealStages.Add(DealStage.Create(DemoTenant, s.Name, s.Order, s.Prob, s.Won, s.Lost, "seed"));
            await db.SaveChangesAsync(ct);
        }

        // 2) Accounts (companies)
        if (!await db.Accounts.IgnoreQueryFilters().AnyAsync(ct))
        {
            var accounts = new (string Name, string Industry, string Web, string Phone, string Size, decimal Rev, string Owner, AccountStatus St)[]
            {
                ("Tata Digital",        "Technology", "tatadigital.com",  "+91 22 6661 8000", "1000+",    480_000_000m, "Vikram Singh",    AccountStatus.Customer),
                ("Reliance Retail",     "Retail",     "relianceretail.com","+91 22 3555 5000", "1000+",    920_000_000m, "Meera Krishnan",  AccountStatus.Customer),
                ("Infosys BPM",         "BPO",        "infosysbpm.com",   "+91 80 2852 0261", "1000+",    310_000_000m, "Arjun Trivedi",   AccountStatus.Prospect),
                ("Zomato",              "Foodtech",   "zomato.com",       "+91 80 4974 6300", "501-1000", 180_000_000m, "Vikram Singh",    AccountStatus.Prospect),
                ("Flipkart Health+",    "Healthtech", "flipkarthealth.in","+91 80 4900 1000", "201-500",   95_000_000m, "Meera Krishnan",  AccountStatus.Prospect),
                ("Swiggy Instamart",    "Q-commerce", "swiggy.com",       "+91 80 6817 9777", "501-1000", 140_000_000m, "Arjun Trivedi",   AccountStatus.Churned)
            };
            foreach (var a in accounts)
                db.Accounts.Add(Account.Create(DemoTenant, a.Name, a.Industry, a.Web, a.Phone, a.Size, a.Rev, a.Owner, a.St, createdBy: "seed"));
            await db.SaveChangesAsync(ct);
        }

        var accByName = (await db.Accounts.IgnoreQueryFilters().ToListAsync(ct)).ToDictionary(a => a.Name);
        var stageByName = (await db.DealStages.IgnoreQueryFilters().ToListAsync(ct)).ToDictionary(s => s.Name);

        // 3) Contacts (people at accounts)
        if (!await db.Contacts.IgnoreQueryFilters().AnyAsync(ct))
        {
            var contacts = new (string Name, string Email, string Phone, string Title, string Account, string Owner, bool Primary)[]
            {
                ("Rohit Bansal",   "rohit.bansal@tatadigital.com",     "+91 98100 11223", "VP Engineering",     "Tata Digital",     "Vikram Singh",   true),
                ("Kavya Reddy",    "kavya.reddy@relianceretail.com",   "+91 98200 33445", "Head of IT",         "Reliance Retail",  "Meera Krishnan", true),
                ("Sanjay Gupta",   "sanjay.gupta@infosysbpm.com",      "+91 98300 55667", "Director, Ops",      "Infosys BPM",      "Arjun Trivedi",  true),
                ("Neha Verma",     "neha.verma@zomato.com",            "+91 98400 77889", "Product Lead",       "Zomato",           "Vikram Singh",   true),
                ("Aman Khanna",    "aman.khanna@flipkarthealth.in",    "+91 98500 99001", "CTO",                "Flipkart Health+", "Meera Krishnan", true),
                ("Pooja Nair",     "pooja.nair@swiggy.com",            "+91 98600 22113", "Procurement Manager","Swiggy Instamart", "Arjun Trivedi",  true),
                ("Vivek Menon",    "vivek.menon@tatadigital.com",      "+91 98700 44225", "Procurement Lead",   "Tata Digital",     "Vikram Singh",   false),
                ("Ritika Shah",    "ritika.shah@relianceretail.com",   "+91 98800 66337", "Finance Controller", "Reliance Retail",  "Meera Krishnan", false)
            };
            foreach (var c in contacts)
            {
                if (!accByName.TryGetValue(c.Account, out var acc)) continue;
                db.Contacts.Add(Contact.Create(DemoTenant,
                    PersonName.Create(c.Name),
                    Email.Create(c.Email),
                    PhoneNumber.Create(c.Phone),
                    c.Title, acc.Id, c.Owner, c.Primary, "seed"));
            }
            await db.SaveChangesAsync(ct);
        }

        // 4) Leads
        if (!await db.Leads.IgnoreQueryFilters().AnyAsync(ct))
        {
            var leads = new (string Name, string Company, string Email, string Phone, LeadSource Source, int Score, string Owner)[]
            {
                ("Ananya Desai",   "PhonePe",        "ananya@phonepe.com",       "+91 99001 11223", LeadSource.Inbound,  88, "Vikram Singh"),
                ("Karan Malhotra", "Razorpay",       "karan@razorpay.com",       "+91 99002 22334", LeadSource.Website,  72, "Meera Krishnan"),
                ("Sneha Pillai",   "Meesho",         "sneha@meesho.com",         "+91 99003 33445", LeadSource.Referral, 65, "Arjun Trivedi"),
                ("Rahul Saxena",   "CRED",           "rahul@cred.club",          "+91 99004 44556", LeadSource.Event,    91, "Vikram Singh"),
                ("Divya Iyer",     "Nykaa",          "divya@nykaa.com",          "+91 99005 55667", LeadSource.Campaign, 54, "Meera Krishnan"),
                ("Manish Agarwal", "Groww",          "manish@groww.in",          "+91 99006 66778", LeadSource.ColdCall, 40, "Arjun Trivedi"),
                ("Tanya Kapoor",   "Urban Company",  "tanya@urbancompany.com",   "+91 99007 77889", LeadSource.Inbound,  77, "Vikram Singh"),
                ("Sahil Mehta",    "Dream11",        "sahil@dream11.com",        "+91 99008 88990", LeadSource.Partner,  83, "Meera Krishnan"),
                ("Ishita Roy",     "Lenskart",       "ishita@lenskart.com",      "+91 99009 99001", LeadSource.Website,  61, "Arjun Trivedi"),
                ("Aakash Jain",    "BharatPe",       "aakash@bharatpe.com",      "+91 99010 11122", LeadSource.Referral, 58, "Vikram Singh"),
                ("Ritu Sharma",    "Ola Electric",   "ritu@olaelectric.com",     "+91 99011 22233", LeadSource.Event,    69, "Meera Krishnan"),
                ("Nikhil Rao",     "Unacademy",      "nikhil@unacademy.com",     "+91 99012 33344", LeadSource.Inbound,  47, "Arjun Trivedi")
            };
            var i = 0;
            foreach (var l in leads)
            {
                db.Leads.Add(Lead.Create(DemoTenant, $"LEAD-{1001 + i}",
                    PersonName.Create(l.Name), l.Company,
                    Email.Create(l.Email),
                    PhoneNumber.Create(l.Phone),
                    l.Source, l.Score, l.Owner, "seed"));
                i++;
            }
            await db.SaveChangesAsync(ct);
        }

        // 5) Deals across stages
        if (!await db.Deals.IgnoreQueryFilters().AnyAsync(ct))
        {
            var deals = new (string Name, string Account, decimal Value, string Stage, string CloseDate, string Owner)[]
            {
                ("Tata Digital — Platform licence",      "Tata Digital",     12_500_000m, "Negotiation", "2026-06-20", "Vikram Singh"),
                ("Reliance Retail — POS rollout",        "Reliance Retail",  28_000_000m, "Proposal",    "2026-07-05", "Meera Krishnan"),
                ("Infosys BPM — Workforce suite",        "Infosys BPM",       8_400_000m, "Qualified",   "2026-06-28", "Arjun Trivedi"),
                ("Zomato — Analytics add-on",            "Zomato",            3_600_000m, "Lead",        "2026-07-18", "Vikram Singh"),
                ("Flipkart Health+ — CRM seats",         "Flipkart Health+",  5_200_000m, "Proposal",    "2026-06-30", "Meera Krishnan"),
                ("Swiggy Instamart — Inventory module",  "Swiggy Instamart",  6_800_000m, "Negotiation", "2026-06-15", "Arjun Trivedi"),
                ("Tata Digital — Premium support",       "Tata Digital",      2_400_000m, "Won",         "2026-05-10", "Vikram Singh"),
                ("Reliance Retail — Loyalty engine",     "Reliance Retail",  15_600_000m, "Qualified",   "2026-08-01", "Meera Krishnan"),
                ("Zomato — Onboarding services",         "Zomato",            1_800_000m, "Won",         "2026-05-02", "Vikram Singh"),
                ("Infosys BPM — Pilot expansion",        "Infosys BPM",       9_900_000m, "Lead",        "2026-08-12", "Arjun Trivedi"),
                ("Flipkart Health+ — Data migration",    "Flipkart Health+",  4_100_000m, "Lead",        "2026-07-25", "Meera Krishnan"),
                ("Swiggy Instamart — Renewal",           "Swiggy Instamart",  7_300_000m, "Lost",        "2026-05-08", "Arjun Trivedi"),
                ("Tata Digital — API gateway",           "Tata Digital",     11_200_000m, "Proposal",    "2026-07-10", "Vikram Singh"),
                ("Reliance Retail — Multi-region",       "Reliance Retail",  19_400_000m, "Negotiation", "2026-06-22", "Meera Krishnan")
            };
            var i = 0;
            foreach (var d in deals)
            {
                if (!accByName.TryGetValue(d.Account, out var acc)) continue;
                if (!stageByName.TryGetValue(d.Stage, out var stage)) continue;
                var deal = Deal.Create(DemoTenant, $"DEAL-{1001 + i}", d.Name, acc.Id, null,
                    d.Value, stage.Id, stage.Probability, DateOnly.Parse(d.CloseDate), d.Owner, "seed");
                if (stage.IsWon) deal.SetStatus(DealStatus.Won, "seed");
                else if (stage.IsLost) deal.SetStatus(DealStatus.Lost, "seed");
                db.Deals.Add(deal);
                i++;
            }
            await db.SaveChangesAsync(ct);
        }

        var allDeals = await db.Deals.IgnoreQueryFilters().ToListAsync(ct);
        var allLeads = await db.Leads.IgnoreQueryFilters().ToListAsync(ct);

        // 6) Activities (calls, emails, meetings, tasks) linked to deals & leads
        if (!await db.Activities.IgnoreQueryFilters().AnyAsync(ct) && allDeals.Count > 0)
        {
            var now = DateTime.UtcNow;
            void Add(ActivityType t, string subj, CrmEntityType rt, Guid rid, double dueDays, string owner)
                => db.Activities.Add(Activity.Create(DemoTenant, t, subj, now.AddDays(dueDays), rt, rid, owner,
                    reminderAt: now.AddDays(dueDays).AddHours(-2), createdBy: "seed"));

            Add(ActivityType.Call,    "Discovery call — scope POS rollout",   CrmEntityType.Deal, allDeals[1].Id,  1,  "Meera Krishnan");
            Add(ActivityType.Meeting, "Solution demo with VP Engineering",    CrmEntityType.Deal, allDeals[0].Id,  2,  "Vikram Singh");
            Add(ActivityType.Email,   "Send revised pricing proposal",        CrmEntityType.Deal, allDeals[4].Id,  3,  "Meera Krishnan");
            Add(ActivityType.Task,    "Prepare security questionnaire",       CrmEntityType.Deal, allDeals[2].Id,  5,  "Arjun Trivedi");
            Add(ActivityType.Call,    "Negotiation follow-up",                CrmEntityType.Deal, allDeals[5].Id, -2,  "Arjun Trivedi");
            Add(ActivityType.Meeting, "Quarterly business review",            CrmEntityType.Deal, allDeals[7].Id,  7,  "Meera Krishnan");
            Add(ActivityType.Email,   "Intro email — qualify budget",         CrmEntityType.Lead, allLeads[0].Id,  1,  "Vikram Singh");
            Add(ActivityType.Call,    "Qualify timeline & authority",         CrmEntityType.Lead, allLeads[3].Id,  2,  "Vikram Singh");
            await db.SaveChangesAsync(ct);
        }

        // 7) Notes
        if (!await db.Notes.IgnoreQueryFilters().AnyAsync(ct) && allDeals.Count > 0)
        {
            db.Notes.AddRange(
                Note.Create(DemoTenant, "Champion is the VP Engineering; economic buyer is the CFO. Budget approved for FY27.", CrmEntityType.Deal, allDeals[0].Id, "Vikram Singh", "seed"),
                Note.Create(DemoTenant, "Competing against an in-house build. Differentiator: time-to-value & SLAs.", CrmEntityType.Deal, allDeals[1].Id, "Meera Krishnan", "seed"),
                Note.Create(DemoTenant, "Security review scheduled. Needs SOC2 report + DPA.", CrmEntityType.Deal, allDeals[2].Id, "Arjun Trivedi", "seed"),
                Note.Create(DemoTenant, "Warm inbound from webinar. High intent — fast-track to demo.", CrmEntityType.Lead, allLeads[0].Id, "Vikram Singh", "seed"),
                Note.Create(DemoTenant, "Met at SaaSBOOMi. Interested in analytics module.", CrmEntityType.Lead, allLeads[3].Id, "Vikram Singh", "seed")
            );
            await db.SaveChangesAsync(ct);
        }
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
            ("Aaron Associate",   "associate@yugma.io",  "Member",  "Associate Engineer",     "Engineering")
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
            AppNotification.Create(DemoTenant, "Leave request pending",         "Rohan Mehta requested 3 days of casual leave starting May 20.", NotificationKind.Warn,    now.AddMinutes(-12), false, "/hr/leave"),
            AppNotification.Create(DemoTenant, "Invoice INV-2026-0421 paid",    "Globex Industries cleared 84,500. Receipt #RC-1187 generated.", NotificationKind.Success, now.AddMinutes(-55), false, "/accounts"),
            AppNotification.Create(DemoTenant, "Low stock alert",                "SKU MAT-0192 (Hex Bolts M8) below reorder point in WH-Pune.",   NotificationKind.Danger,  now.AddHours(-2),    true,  "/material"),
            AppNotification.Create(DemoTenant, "Workflow approved",              "PO #PO-7782 was approved by Finance. Vendor notified.",         NotificationKind.Info,    now.AddHours(-5),    true,  "/workflow")
        );
        await db.SaveChangesAsync(ct);
    }
}

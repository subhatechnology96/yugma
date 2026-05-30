using Yugma.Crm.Domain.Hr;
using Yugma.Crm.Domain.Hr.Career;

namespace Yugma.Crm.Api.Profile;

/// <summary>
/// Builds an employee's complete professional history — role progression, managers, projects (with
/// timelines, responsibilities, feedback and ratings), achievements and a chronological timeline.
/// Generated deterministically across the whole tenure, then merged with any user-tracked projects.
/// </summary>
public static class CareerFactory
{
    public static CareerDto Build(Employee e, DateOnly today, IReadOnlyList<EmployeeProject> custom)
    {
        var rng = Rng(e.Id, 7);
        var tenure = Math.Round((today.ToDateTime(TimeOnly.MinValue) - e.JoinedAt.ToDateTime(TimeOnly.MinValue)).TotalDays / 365.25, 1);

        var roles = BuildRoles(e, today);
        var managers = BuildManagers(roles);
        var generated = BuildProjects(e, today, roles, rng);
        var achievements = BuildAchievements(e, today, rng);

        var projects = custom.Select(ToDto).Concat(generated)
            .OrderByDescending(p => p.StartDate).ToList();

        var summary = new CareerSummaryDto(
            e.Name.Full, e.Designation, e.Department, e.AvatarUrl, e.JoinedAt, tenure,
            projects.Count,
            projects.Count(p => p.Status == "Completed"),
            projects.Count(p => p.Status == "Ongoing"),
            Math.Max(0, roles.Count - 1),
            achievements.Count,
            projects.Count == 0 ? 0 : Math.Round(projects.Average(p => p.Rating), 1),
            e.Skills.Take(8).ToList());

        var timeline = BuildTimeline(e, roles, projects, achievements);

        return new CareerDto(summary, roles, managers, achievements, timeline, projects);
    }

    // ---------------- role progression ----------------
    private static List<RoleStintDto> BuildRoles(Employee e, DateOnly today)
    {
        var ladder = LadderFor(e.Department);
        var tenureDays = today.DayNumber - e.JoinedAt.DayNumber;
        var tenureYears = tenureDays / 365.25;

        // progression should end at the current designation (no duplicate "promotions" to the same title)
        int endIdx = Array.FindIndex(ladder, t => string.Equals(t, e.Designation, StringComparison.OrdinalIgnoreCase));
        var upTo = endIdx >= 0 ? ladder.Take(endIdx + 1).ToArray() : ladder;
        int maxCount = upTo.Length;
        int count = (int)Math.Clamp(Math.Round(tenureYears / 3.2) + 1, 1, maxCount);

        var titles = upTo.Skip(Math.Max(0, upTo.Length - count)).ToList();
        if (endIdx < 0) titles[^1] = e.Designation;     // designation not on the ladder → still end on it

        var mgrPool = ManagerPool(e);
        var stints = new List<RoleStintDto>();
        // segments grow slightly longer over time
        var weights = Enumerable.Range(1, count).Select(i => (double)i).ToArray();
        var wsum = weights.Sum();
        int dayCursor = e.JoinedAt.DayNumber;
        for (int i = 0; i < count; i++)
        {
            var from = DateOnly.FromDayNumber(dayCursor);
            int span = (int)Math.Round(tenureDays * (weights[i] / wsum));
            dayCursor = i == count - 1 ? today.DayNumber : Math.Min(today.DayNumber, dayCursor + Math.Max(span, 200));
            DateOnly? to = i == count - 1 ? null : DateOnly.FromDayNumber(dayCursor);
            var years = Math.Round(((to?.DayNumber ?? today.DayNumber) - from.DayNumber) / 365.25, 1);
            var mgr = i == count - 1 ? (string.IsNullOrWhiteSpace(e.Manager) ? "Reporting manager" : e.Manager!) : mgrPool[i % mgrPool.Count];
            stints.Add(new RoleStintDto(titles[i], LevelFor(i, count), from, to, mgr, years));
        }
        return stints;
    }

    private static List<ManagerStintDto> BuildManagers(List<RoleStintDto> roles)
        => roles.Select((r, i) => new ManagerStintDto(
            r.Manager, i == roles.Count - 1 ? "Current manager" : "Former manager", r.From, r.To)).ToList();

    // ---------------- projects ----------------
    private static List<ProjectDto> BuildProjects(Employee e, DateOnly today, List<RoleStintDto> roles, Random rng)
    {
        var tenureDays = today.DayNumber - e.JoinedAt.DayNumber;
        var tenureYears = tenureDays / 365.25;
        int count = (int)Math.Clamp(Math.Round(tenureYears * 1.4), 3, 28);

        var list = new List<ProjectDto>();
        for (int i = 0; i < count; i++)
        {
            var startDay = e.JoinedAt.DayNumber + rng.Next(0, Math.Max(1, tenureDays - 30));
            var start = DateOnly.FromDayNumber(startDay);
            int durMonths = rng.Next(2, 15);
            var end = start.AddMonths(durMonths);

            bool ongoing = i < 2 && end >= today;       // a couple of recent ongoing ones
            var status = ongoing ? "Ongoing" : "Completed";
            if (!ongoing && end > today) end = today;

            var stint = roles.LastOrDefault(s => s.From <= start) ?? roles[0];
            int rating = WeightedRating(rng);
            var domain = Domains[rng.Next(Domains.Length)];
            var name = $"{domain} · {Codenames[rng.Next(Codenames.Length)]}";

            list.Add(new ProjectDto(
                DeterministicId(e.Id, i).ToString(), false, name, domain, stint.Title, stint.Manager,
                start, ongoing ? null : end, status, rating,
                MonthsBetween(start, ongoing ? today : end), rng.Next(3, 16),
                Pick(Responsibilities, rng, 3 + rng.Next(0, 3)),
                Outcomes[rng.Next(Outcomes.Length)], FeedbackFor(rating),
                BuildSkills(e, rng),
                rng.NextDouble() < 0.4 ? new List<string> { ProjectAwards[rng.Next(ProjectAwards.Length)] } : new List<string>()));
        }
        return list.OrderByDescending(p => p.StartDate).ToList();
    }

    private static ProjectDto ToDto(EmployeeProject p) => new(
        p.Id.ToString(), true, p.Name, p.Domain, p.Role, p.Manager ?? "—",
        p.StartDate, p.EndDate, p.Status, p.Rating,
        MonthsBetween(p.StartDate, p.EndDate ?? DateOnly.FromDateTime(DateTime.UtcNow)), p.TeamSize,
        (p.Responsibilities ?? "").Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList(),
        p.Outcome ?? "", p.Feedback ?? "",
        (p.Skills ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList(),
        new List<string>());

    // ---------------- achievements ----------------
    private static List<AchievementDto> BuildAchievements(Employee e, DateOnly today, Random rng)
    {
        var tenureYears = (today.DayNumber - e.JoinedAt.DayNumber) / 365.25;
        var list = new List<AchievementDto>();

        // long-service milestones
        foreach (var yr in new[] { 5, 10, 15, 20, 25 })
            if (tenureYears >= yr)
                list.Add(new AchievementDto(e.JoinedAt.AddYears(yr), $"{yr}-Year Long Service Award",
                    $"Recognised for {yr} years of dedicated service.", "Milestone"));

        int extra = (int)Math.Clamp(Math.Round(tenureYears / 2.5), 1, 8);
        for (int i = 0; i < extra; i++)
        {
            var day = e.JoinedAt.DayNumber + rng.Next(120, Math.Max(150, today.DayNumber - e.JoinedAt.DayNumber));
            var title = Awards[rng.Next(Awards.Length)];
            list.Add(new AchievementDto(DateOnly.FromDayNumber(Math.Min(day, today.DayNumber)), title,
                AwardDesc[rng.Next(AwardDesc.Length)], "Award"));
        }
        return list.OrderByDescending(a => a.Date).ToList();
    }

    // ---------------- timeline ----------------
    private static List<CareerEventDto> BuildTimeline(Employee e, List<RoleStintDto> roles, List<ProjectDto> projects, List<AchievementDto> achievements)
    {
        var events = new List<CareerEventDto>
        {
            new(e.JoinedAt, "joined", $"Joined {e.Department}", $"Started as {roles[0].Title}", "pi-flag")
        };
        for (int i = 1; i < roles.Count; i++)
            events.Add(new CareerEventDto(roles[i].From, "promotion", $"Promoted to {roles[i].Title}", $"Reporting to {roles[i].Manager}", "pi-arrow-up-right"));
        foreach (var a in achievements.Take(6))
            events.Add(new CareerEventDto(a.Date, "award", a.Title, a.Description, "pi-trophy"));
        foreach (var p in projects.Where(p => !p.IsCustom).Take(6))
            events.Add(new CareerEventDto(p.StartDate, "project", $"Project · {p.Name}", $"{p.Role} · {p.Status}", "pi-briefcase"));

        return events.OrderByDescending(x => x.Date).ToList();
    }

    // ---------------- pools & helpers ----------------
    private static readonly string[] Domains =
    { "Platform Modernization", "Customer Portal", "Payments", "Data Migration", "Cloud Migration", "Analytics Suite", "Mobile App", "API Gateway", "Process Automation", "Security Hardening", "Onboarding Revamp", "Integration Hub" };
    private static readonly string[] Codenames =
    { "Atlas", "Orbit", "Nova", "Pinnacle", "Horizon", "Falcon", "Quantum", "Vega", "Titan", "Zenith", "Apollo", "Catalyst" };
    private static readonly string[] Responsibilities =
    {
        "Owned end-to-end delivery of the module", "Led design and architecture decisions", "Mentored junior team members",
        "Coordinated across cross-functional stakeholders", "Drove sprint planning and execution", "Built and maintained CI/CD pipelines",
        "Conducted code reviews and enforced quality gates", "Defined KPIs and tracked outcomes", "Owned client communication and demos",
        "Hardened production and reduced incidents"
    };
    private static readonly string[] Outcomes =
    {
        "Delivered two weeks ahead of schedule", "Improved performance by ~35%", "Reduced manual effort by 60%",
        "Achieved 99.9% uptime post-launch", "Onboarded 12 enterprise clients", "Increased adoption by 40%", "Zero critical defects in production"
    };
    private static readonly string[] ProjectAwards = { "Best Project of the Quarter", "Innovation Spotlight", "Customer Choice Award", "Excellence in Delivery" };
    private static readonly string[] Awards = { "Star Performer", "Spot Award", "Innovation Award", "Team Excellence Award", "Customer Hero", "Mentor of the Year", "President's Club" };
    private static readonly string[] AwardDesc =
    {
        "Recognised for exceptional impact this cycle.", "Awarded for going above and beyond on a critical deliverable.",
        "Honoured for outstanding collaboration and ownership.", "Celebrated for mentoring and lifting the team."
    };

    private static string[] LadderFor(string dept)
    {
        var d = dept.ToLowerInvariant();
        if (d.Contains("engineer") || d.Contains("product") || d.Contains("data"))
            return new[] { "Associate Engineer", "Software Engineer", "Senior Engineer", "Lead Engineer", "Engineering Manager", "Engineering Director" };
        if (d.Contains("sales"))
            return new[] { "Sales Associate", "Account Executive", "Senior Account Executive", "Sales Manager", "Head of Sales", "VP Sales" };
        if (d.Contains("finance"))
            return new[] { "Finance Associate", "Finance Analyst", "Senior Analyst", "Finance Manager", "Senior Finance Manager", "Finance Director" };
        if (d.Contains("hr") || d.Contains("people"))
            return new[] { "HR Associate", "HR Specialist", "HRBP", "HR Manager", "Senior HR Manager", "Head of People" };
        if (d.Contains("market"))
            return new[] { "Marketing Associate", "Marketing Executive", "Senior Executive", "Marketing Manager", "Senior Marketing Manager", "Marketing Director" };
        if (d.Contains("customer") || d.Contains("success"))
            return new[] { "Support Associate", "Customer Success Associate", "CSM", "Senior CSM", "CS Manager", "Head of Customer Success" };
        return new[] { "Associate", "Executive", "Senior Executive", "Manager", "Senior Manager", "Director" };
    }

    private static string LevelFor(int index, int count)
    {
        // map position within the held stints to a band label
        double frac = count <= 1 ? 1 : (double)index / (count - 1);
        return frac < 0.2 ? "Entry" : frac < 0.45 ? "Mid" : frac < 0.7 ? "Senior" : frac < 0.9 ? "Lead" : "Leadership";
    }

    private static List<string> ManagerPool(Employee e)
    {
        var pool = new List<string> { "Aarav Verma", "Rohan Mehta", "Vikram Singh", "Priya Sharma", "Devansh Patel", "Sneha Iyer" };
        pool.Remove(e.Name.Full); // never report to oneself
        return pool.Count == 0 ? new List<string> { "Aarav Verma" } : pool;
    }

    private static List<string> BuildSkills(Employee e, Random rng)
    {
        var tech = new[] { ".NET", "Angular", "PostgreSQL", "AWS", "Kubernetes", "Kafka", "React", "Python", "Azure", "Terraform" };
        var set = new HashSet<string>(e.Skills.Take(2));
        int add = rng.Next(2, 4);
        for (int i = 0; i < add; i++) set.Add(tech[rng.Next(tech.Length)]);
        return set.Take(5).ToList();
    }

    private static int WeightedRating(Random r)
    {
        var x = r.NextDouble();
        return x < 0.12 ? 3 : x < 0.55 ? 4 : 5;
    }

    private static string FeedbackFor(int rating) => rating switch
    {
        5 => "Outstanding ownership and impact; exceeded all expectations.",
        4 => "Strong delivery and collaboration; a dependable contributor.",
        _ => "Met expectations with solid execution and room to stretch."
    };

    private static List<string> Pick(string[] pool, Random r, int n)
    {
        var idx = Enumerable.Range(0, pool.Length).OrderBy(_ => r.Next()).Take(Math.Min(n, pool.Length));
        return idx.Select(i => pool[i]).ToList();
    }

    private static int MonthsBetween(DateOnly a, DateOnly b)
        => Math.Max(1, (b.Year - a.Year) * 12 + (b.Month - a.Month));

    private static Guid DeterministicId(Guid id, int i)
    {
        var rg = Rng(id, 1000 + i);
        var bytes = new byte[16];
        rg.NextBytes(bytes);
        return new Guid(bytes);
    }

    private static Random Rng(Guid id, int salt)
    {
        var bytes = id.ToByteArray();
        int h = salt;
        foreach (var x in bytes) h = unchecked(h * 31 + x);
        return new Random(h);
    }
}

using Yugma.Crm.Domain.Hr;

namespace Yugma.Crm.Api.Profile;

/// <summary>
/// Produces rich, presentation-ready profile data (overview, attendance, leave, payroll) for an
/// employee. Everything is generated deterministically from the employee id so the figures stay
/// stable across requests — ideal for demos while behaving like a real, populated HRIS.
/// </summary>
public static class EmployeeProfileFactory
{
    // ---- deterministic RNG --------------------------------------------------
    private static Random Rng(Guid id, int salt)
    {
        var bytes = id.ToByteArray();
        int h = salt;
        foreach (var x in bytes) h = unchecked(h * 31 + x);
        return new Random(h);
    }

    private static T Pick<T>(this Random r, IReadOnlyList<T> items) => items[r.Next(items.Count)];
    private static decimal Round(decimal v) => Math.Round(v, 0, MidpointRounding.AwayFromZero);

    // ========================================================================
    //  OVERVIEW
    // ========================================================================
    /// <summary>
    /// Builds the overview from the employee's record + a PERSISTED profile row (personal details from
    /// Postgres). If no profile row exists yet (e.g. a brand-new employee), it falls back to a freshly
    /// generated one so the screen never breaks.
    /// </summary>
    public static EmployeeOverviewDto BuildOverview(Employee e, DateOnly today, Domain.Hr.Profile.EmployeeProfile? profile)
    {
        var p = profile ?? GenerateProfile(e, today);

        var tenure = Math.Round((today.ToDateTime(TimeOnly.MinValue) - e.JoinedAt.ToDateTime(TimeOnly.MinValue)).TotalDays / 365.25, 1);
        var probationEnds = e.JoinedAt.AddMonths(6);
        var nextReview = NextReviewDate(today);

        var attendance = BuildAttendance(e, today);
        var leave = BuildLeave(e, today);
        var payroll = BuildPayroll(e, today);

        return new EmployeeOverviewDto(
            e.Department, e.Designation, MapEmploymentType(e.EmploymentType),
            string.IsNullOrWhiteSpace(e.Manager) ? "—" : e.Manager!,
            e.Location, p.Worksite, p.Grade,
            e.JoinedAt, probationEnds, nextReview, tenure,
            e.Performance, attendance.AttendanceRatePct, leave.TotalAvailable, payroll.Latest.NetPay,
            e.Email.Value, p.PersonalEmail, e.Phone.Value, p.DateOfBirth,
            p.BloodGroup, p.MaritalStatus, p.Address,
            p.EmergencyName, p.EmergencyRelation, p.EmergencyPhone,
            p.PanMasked, p.AadhaarMasked, p.BankName, p.BankAccountMasked, p.Uan,
            p.About, e.Skills, BuildTimeline(e, today));
    }

    /// <summary>
    /// Deterministically generates an employee's personal profile (used once at seed time to populate the
    /// <c>employee_profiles</c> table, and as a fallback for employees created after seeding).
    /// </summary>
    public static Domain.Hr.Profile.EmployeeProfile GenerateProfile(Employee e, DateOnly today)
    {
        var r = Rng(e.Id, 11);
        var tenure = Math.Round((today.ToDateTime(TimeOnly.MinValue) - e.JoinedAt.ToDateTime(TimeOnly.MinValue)).TotalDays / 365.25, 1);

        var bloodGroups = new[] { "O+", "B+", "A+", "AB+", "O-", "B-" };
        var marital = new[] { "Single", "Married", "Married", "Single" };
        var relations = new[] { "Spouse", "Parent", "Sibling", "Parent" };
        var banks = new[] { "HDFC Bank", "ICICI Bank", "Axis Bank", "State Bank of India", "Kotak Mahindra Bank" };
        var grades = new[] { "L2", "L3", "L4", "L5", "M1", "M2" };

        var firstName = e.Name.Full.Split(' ')[0].ToLowerInvariant();
        var about = $"{e.Name.Full} is a {e.Designation.ToLowerInvariant()} in the {e.Department} team, based out of {e.Location}. " +
                    $"With {tenure:0.#} years at Yugma, {firstName.Substring(0, 1).ToUpperInvariant()}{firstName.Substring(1)} " +
                    $"partners closely with {(string.IsNullOrWhiteSpace(e.Manager) ? "leadership" : e.Manager)} and is recognised for " +
                    $"{r.Pick(new[] { "strong ownership", "cross-functional collaboration", "mentoring juniors", "delivery excellence", "customer empathy" })}.";

        var profile = Domain.Hr.Profile.EmployeeProfile.Create(e.TenantId, e.Id);
        profile.PersonalEmail = $"{firstName}{r.Next(10, 99)}@gmail.com";
        profile.DateOfBirth = e.JoinedAt.AddYears(-(r.Next(24, 38))).AddDays(r.Next(0, 360));
        profile.Worksite = r.Pick(new[] { "On-site", "Hybrid", "Hybrid", "Remote" });
        profile.Grade = e.Performance >= 5 ? r.Pick(new[] { "L5", "M1", "M2" }) : r.Pick(grades);
        profile.BloodGroup = r.Pick(bloodGroups);
        profile.MaritalStatus = r.Pick(marital);
        profile.Address = AddressFor(r, e.Location);
        profile.EmergencyName = EmergencyName(r, e.Name.Full);
        profile.EmergencyRelation = r.Pick(relations);
        profile.EmergencyPhone = $"+91 {r.Next(70000, 99999)} {r.Next(10000, 99999)}";
        profile.PanMasked = $"{RandLetters(r, 5)}{r.Next(1000, 9999)}{RandLetters(r, 1)}";
        profile.AadhaarMasked = $"XXXX XXXX {r.Next(1000, 9999)}";
        profile.BankName = r.Pick(banks);
        profile.BankAccountMasked = $"XXXXXX{r.Next(1000, 9999)}";
        profile.Uan = $"1{r.Next(10000000, 99999999)}{r.Next(100, 999)}";
        profile.About = about;
        return profile;
    }

    private static IReadOnlyList<TimelineEntryDto> BuildTimeline(Employee e, DateOnly today)
    {
        var list = new List<TimelineEntryDto>
        {
            new(e.JoinedAt, "Joined Yugma", $"Onboarded as {e.Designation} · {e.Department}", "pi-flag")
        };

        var tenureYears = (today.ToDateTime(TimeOnly.MinValue) - e.JoinedAt.ToDateTime(TimeOnly.MinValue)).TotalDays / 365.25;
        if (tenureYears >= 1)
            list.Add(new(e.JoinedAt.AddMonths(6), "Probation cleared", "Confirmed as a permanent employee", "pi-check-circle"));
        if (tenureYears >= 2 && e.Performance >= 4)
            list.Add(new(e.JoinedAt.AddYears(2), "Promotion", $"Elevated to {e.Designation}", "pi-arrow-up-right"));

        list.Add(new(LastReviewDate(today), "Performance review", $"Rated {e.Performance}/5 in the last cycle", "pi-star"));
        return list.OrderByDescending(t => t.Date).ToList();
    }

    // ========================================================================
    //  ATTENDANCE  (last ~22 working days)
    // ========================================================================
    public static AttendanceOverviewDto BuildAttendance(Employee e, DateOnly today)
    {
        var r = Rng(e.Id, 23);
        const int targetDays = 22;

        var days = new List<DateOnly>();
        var cursor = today;
        while (days.Count < targetDays)
        {
            if (cursor.DayOfWeek is not (DayOfWeek.Saturday or DayOfWeek.Sunday))
                days.Add(cursor);
            cursor = cursor.AddDays(-1);
        }
        days.Reverse();

        int present = 0, late = 0, wfh = 0, onLeave = 0, absent = 0;
        double totalHours = 0;
        var records = new List<AttendanceDayDto>();

        foreach (var d in days)
        {
            var roll = r.NextDouble();
            string status; string? inT = null; string? outT = null; double hours = 0;

            if (roll < 0.05) { status = "Leave"; onLeave++; }
            else if (roll < 0.07) { status = "Absent"; absent++; }
            else if (roll < 0.18)
            {
                status = "Late"; late++;
                inT = $"{r.Next(9, 11):00}:{r.Next(35, 59):00}"; outT = $"{r.Next(18, 20):00}:{r.Next(0, 59):00}";
                hours = Math.Round(7.5 + r.NextDouble() * 1.6, 1);
            }
            else if (roll < 0.40)
            {
                status = "Wfh"; wfh++;
                inT = $"09:{r.Next(0, 30):00}"; outT = $"18:{r.Next(0, 59):00}";
                hours = Math.Round(7.8 + r.NextDouble() * 1.4, 1);
            }
            else
            {
                status = "Present"; present++;
                inT = $"09:{r.Next(0, 25):00}"; outT = $"18:{r.Next(10, 59):00}";
                hours = Math.Round(8.4 + r.NextDouble() * 1.3, 1);
            }

            totalHours += hours;
            records.Add(new AttendanceDayDto(d, d.DayOfWeek.ToString()[..3], status, inT, outT, hours));
        }

        int worked = present + late + wfh;
        var attendanceRate = Math.Round((double)(present + late + wfh) / targetDays * 100, 1);
        var punctuality = (present + late) == 0 ? 100 : Math.Round((double)present / (present + late) * 100, 1);
        var avgHours = worked == 0 ? 0 : Math.Round(totalHours / worked, 1);

        return new AttendanceOverviewDto(
            targetDays, present, late, wfh, onLeave, absent,
            attendanceRate, punctuality, avgHours, Math.Round(totalHours, 1),
            records.OrderByDescending(x => x.Date).ToList());
    }

    // ========================================================================
    //  LEAVE
    // ========================================================================
    public static LeaveOverviewDto BuildLeave(Employee e, DateOnly today)
    {
        var r = Rng(e.Id, 37);

        var entitlements = new (string Type, double Entitled)[]
        {
            ("Casual", 12), ("Sick", 12), ("Earned", 18), ("Comp-off", 6)
        };

        var reasons = new Dictionary<string, string[]>
        {
            ["Casual"] = new[] { "Family function", "Personal work", "House shifting", "Festival at hometown" },
            ["Sick"] = new[] { "Fever and cold", "Medical checkup", "Recovery — viral", "Dental procedure" },
            ["Earned"] = new[] { "Vacation with family", "Trip abroad", "Wedding in the family", "Long weekend break" },
            ["Comp-off"] = new[] { "Comp-off for weekend release", "Comp-off for on-call", "Worked on a holiday" }
        };

        // Build history first, then derive used/pending from it for internal consistency.
        var history = new List<LeaveItemDto>();
        var approver = string.IsNullOrWhiteSpace(e.Manager) ? "Reporting manager" : e.Manager!;
        int entries = r.Next(5, 8);

        for (int i = 0; i < entries; i++)
        {
            var (type, _) = r.Pick(entitlements);
            // Spread mostly in the past 9 months, with a small chance of an upcoming request.
            bool upcoming = i == 0 && r.NextDouble() < 0.6;
            var start = upcoming
                ? today.AddDays(r.Next(4, 30))
                : today.AddDays(-r.Next(10, 270));
            int len = type == "Earned" ? r.Next(3, 8) : r.Next(1, 3);
            var end = start.AddDays(len - 1);

            string status = upcoming ? "Pending" : (r.NextDouble() < 0.12 ? "Rejected" : "Approved");
            var appliedOn = start.AddDays(-r.Next(3, 14));

            history.Add(new LeaveItemDto(start, end, len, type, status,
                r.Pick(reasons[type]), appliedOn, approver));
        }
        history = history.OrderByDescending(h => h.From).ToList();

        var balances = entitlements.Select(en =>
        {
            double used = history.Where(h => h.Type == en.Type && h.Status == "Approved").Sum(h => h.Days);
            double pending = history.Where(h => h.Type == en.Type && h.Status == "Pending").Sum(h => h.Days);
            double available = Math.Max(0, en.Entitled - used - pending);
            return new LeaveBalanceDto(en.Type, en.Entitled, used, pending, available);
        }).ToList();

        return new LeaveOverviewDto(
            balances.Sum(b => b.Entitled),
            balances.Sum(b => b.Used),
            balances.Sum(b => b.Available),
            balances, history);
    }

    // ========================================================================
    //  PAYROLL  (last 12 months)
    // ========================================================================
    public static PayrollOverviewDto BuildPayroll(Employee e, DateOnly today)
    {
        var r = Rng(e.Id, 53);
        var annual = e.CtcLakhs * 100_000m;
        var grossMonthly = annual / 12m;

        var basic = Round(grossMonthly * 0.40m);
        var hra = Round(basic * 0.50m);
        const decimal conveyance = 1600m;
        var special = Round(grossMonthly - basic - hra - conveyance);
        if (special < 0) special = 0;

        var pf = Round(basic * 0.12m);
        const decimal profTax = 200m;
        var annualTax = ComputeAnnualTax(annual);
        var incomeTax = Round(annualTax / 12m);

        // 12 months ending with the most recent completed month.
        var firstOfThisMonth = new DateOnly(today.Year, today.Month, 1);
        var payslips = new List<PayslipDto>();

        for (int i = 12; i >= 1; i--)
        {
            var monthStart = firstOfThisMonth.AddMonths(-i);
            var period = monthStart.ToString("MMM yyyy", System.Globalization.CultureInfo.InvariantCulture);
            var payDate = monthStart.AddMonths(1).AddDays(-1); // last day of that month

            // Annual statutory/performance bonus paid in April.
            decimal bonus = monthStart.Month == 4 ? Round(grossMonthly * (0.5m + (decimal)r.NextDouble())) : 0m;
            // Occasional small variable deductions (loan EMI, advance recovery).
            decimal other = r.NextDouble() < 0.25 ? Round((decimal)r.Next(500, 3500)) : 0m;

            var grossEarnings = basic + hra + special + conveyance + bonus;
            var totalDeductions = pf + profTax + incomeTax + other;
            var net = grossEarnings - totalDeductions;

            payslips.Add(new PayslipDto(
                period, payDate, "Paid", DaysInMonth(monthStart),
                basic, hra, special, conveyance, bonus, grossEarnings,
                pf, profTax, incomeTax, other, totalDeductions, net));
        }

        payslips.Reverse(); // newest first
        var latest = payslips[0];

        // YTD across the current financial year (Apr 1 → now).
        int fyStartYear = today.Month >= 4 ? today.Year : today.Year - 1;
        var fyStart = new DateOnly(fyStartYear, 4, 1);
        var fySlips = payslips.Where(p => p.PayDate >= fyStart).ToList();

        return new PayrollOverviewDto(
            annual,
            latest.GrossEarnings,
            latest.NetPay,
            fySlips.Sum(p => p.GrossEarnings),
            fySlips.Sum(p => p.NetPay),
            fySlips.Sum(p => p.IncomeTax),
            "INR",
            latest,
            payslips);
    }

    // ---- tax (new regime, FY 2025-26, simplified) ---------------------------
    private static decimal ComputeAnnualTax(decimal annualGross)
    {
        var taxable = annualGross - 75_000m; // standard deduction
        if (taxable <= 0) return 0m;

        // Rebate u/s 87A — no tax up to ₹7L taxable.
        if (taxable <= 700_000m) return 0m;

        decimal tax = 0m;
        (decimal upTo, decimal rate)[] slabs =
        {
            (300_000m, 0.00m),
            (600_000m, 0.05m),
            (900_000m, 0.10m),
            (1_200_000m, 0.15m),
            (1_500_000m, 0.20m),
            (decimal.MaxValue, 0.30m)
        };
        decimal lower = 0m;
        foreach (var (upTo, rate) in slabs)
        {
            if (taxable > lower)
            {
                var slice = Math.Min(taxable, upTo) - lower;
                tax += slice * rate;
                lower = upTo;
            }
            else break;
        }
        return Round(tax * 1.04m); // + 4% health & education cess
    }

    // ---- small helpers ------------------------------------------------------
    private static int DaysInMonth(DateOnly d) => DateTime.DaysInMonth(d.Year, d.Month);

    private static string MapEmploymentType(EmploymentType t) => t switch
    {
        EmploymentType.FullTime => "Full-time",
        EmploymentType.PartTime => "Part-time",
        EmploymentType.Contract => "Contract",
        _ => "Intern"
    };

    private static DateOnly NextReviewDate(DateOnly today)
    {
        // Half-yearly cycles: Jun 30 / Dec 31.
        var jun = new DateOnly(today.Year, 6, 30);
        var dec = new DateOnly(today.Year, 12, 31);
        if (today <= jun) return jun;
        if (today <= dec) return dec;
        return new DateOnly(today.Year + 1, 6, 30);
    }

    private static DateOnly LastReviewDate(DateOnly today)
    {
        var jun = new DateOnly(today.Year, 6, 30);
        var decPrev = new DateOnly(today.Year - 1, 12, 31);
        return today > jun ? jun : decPrev;
    }

    private static string RandLetters(Random r, int n)
    {
        const string a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        return new string(Enumerable.Range(0, n).Select(_ => a[r.Next(a.Length)]).ToArray());
    }

    private static string EmergencyName(Random r, string fullName)
    {
        var last = fullName.Contains(' ') ? fullName[(fullName.LastIndexOf(' ') + 1)..] : "Kumar";
        var firsts = new[] { "Anil", "Sunita", "Rakesh", "Meena", "Vijay", "Kavita", "Suresh", "Lata" };
        return $"{r.Pick(firsts)} {last}";
    }

    private static string AddressFor(Random r, string city)
    {
        var areas = new Dictionary<string, string[]>
        {
            ["Bengaluru"] = new[] { "Koramangala", "Indiranagar", "HSR Layout", "Whitefield" },
            ["Mumbai"] = new[] { "Andheri West", "Powai", "Bandra", "Goregaon" },
            ["Pune"] = new[] { "Kothrud", "Baner", "Viman Nagar", "Hinjewadi" },
            ["Delhi"] = new[] { "Saket", "Dwarka", "Rohini", "Vasant Kunj" },
            ["Hyderabad"] = new[] { "Gachibowli", "Madhapur", "Kondapur", "Banjara Hills" },
            ["Chennai"] = new[] { "Adyar", "Velachery", "T. Nagar", "OMR" }
        };
        var area = areas.TryGetValue(city, out var a) ? r.Pick(a) : "Central";
        return $"{r.Next(1, 280)}, {area}, {city}";
    }
}

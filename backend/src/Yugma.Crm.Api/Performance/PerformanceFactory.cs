using Yugma.Crm.Domain.Hr;
using Yugma.Crm.Domain.Hr.Performance;

namespace Yugma.Crm.Api.Performance;

/// <summary>
/// Generates per-employee performance review history (year-wise + quarter-wise) deterministically
/// from the employee id, anchored on their current rating with a gentle improvement trend. Aggregated
/// into an org summary and a tracker so the figures stay stable across requests.
/// </summary>
public static class PerformanceFactory
{
    /// <summary>Fallback used only if the competencies table is empty.</summary>
    private static readonly string[] DefaultCompetencies = { "Delivery", "Collaboration", "Ownership", "Innovation", "Communication" };

    public static string Key(Guid employeeId, int year, int quarter) => $"{employeeId}:{year}:{quarter}";

    private sealed record QInfo(int Year, int Quarter);

    // ---------------- per-employee detail ----------------
    public static PerfEmployeeDto BuildEmployee(Employee e, DateOnly today, IReadOnlyList<string> competencies, IReadOnlyDictionary<string, PerformanceReview>? overrides = null)
    {
        var quarters = QuarterSeries(e.JoinedAt, today);
        var reviews = quarters.Select(q => BuildQuarter(e, q, today, competencies, overrides)).ToList();

        var years = reviews
            .GroupBy(r => r.YearKey)
            .OrderByDescending(g => g.Key)
            .Select(g => new PerfYearDto(g.Key, Avg(g.Select(x => x.Rating)), g.Count(),
                g.OrderBy(x => x.Quarter).Select(ToDto).ToList()))
            .ToList();

        var ordered = reviews.OrderBy(r => r.YearKey).ThenBy(r => r.Quarter).Select(r => r.Rating).ToList();
        var current = ordered.Count > 0 ? ordered[^1] : e.Performance;
        var prev = ordered.Count > 1 ? ordered[^2] : current;

        return new PerfEmployeeDto(
            e.Id, e.Name.Full, e.Designation, e.Department, e.AvatarUrl,
            string.IsNullOrWhiteSpace(e.Manager) ? "Reporting manager" : e.Manager!,
            current, Math.Round(current - prev, 1), NineBox(e, current), years);
    }

    // ---------------- tracker ----------------
    public static IReadOnlyList<PerfTrackerRowDto> BuildTracker(IReadOnlyList<Employee> employees, DateOnly today, IReadOnlyList<string> competencies, IReadOnlyDictionary<string, PerformanceReview>? overrides = null)
        => employees.OrderByDescending(e => Latest(e, today, competencies, overrides)).Select(e =>
        {
            var series = QuarterSeries(e.JoinedAt, today).Select(q => BuildQuarter(e, q, today, competencies, overrides)).ToList();
            var ratings = series.Select(s => s.Rating).ToList();
            var current = ratings.Count > 0 ? ratings[^1] : e.Performance;
            var prev = ratings.Count > 1 ? ratings[^2] : current;
            var trend = ratings.TakeLast(4).ToList();
            var last = series.Count > 0 ? series[^1] : null;
            return new PerfTrackerRowDto(
                e.Id, e.Name.Full, e.Designation, e.Department, e.AvatarUrl,
                current, prev, Math.Round(current - prev, 1), trend,
                last?.Label ?? "—", last?.Status ?? "—", current < 2.6, NineBox(e, current));
        }).ToList();

    // ---------------- org summary ----------------
    public static PerfSummaryDto BuildSummary(IReadOnlyList<Employee> employees, int year, DateOnly today, IReadOnlyList<string> competencies, IReadOnlyDictionary<string, PerformanceReview>? overrides = null)
    {
        var currents = employees.Select(e => Latest(e, today, competencies, overrides)).ToList();
        var avg = currents.Count == 0 ? 0 : Math.Round(currents.Average(), 2);
        var dist = new int[5];
        foreach (var r in currents) { var b = Math.Clamp((int)Math.Round(r) - 1, 0, 4); dist[b]++; }

        var byQuarter = new List<QuarterAvgDto>();
        var (cy, cq) = CurrentYearQuarter(today);
        for (int q = 1; q <= 4; q++)
        {
            var status = year > cy || (year == cy && q > cq) ? "upcoming"
                       : year == cy && q == cq ? "in review" : "calibrated";
            if (status == "upcoming") { byQuarter.Add(new QuarterAvgDto(q, $"Q{q}", 0, status)); continue; }
            var ratings = employees
                .Where(e => new DateOnly(year, (q - 1) * 3 + 1, 1) >= MonthStart(e.JoinedAt))
                .Select(e => BuildQuarter(e, new QInfo(year, q), today, competencies, overrides).Rating).ToList();
            byQuarter.Add(new QuarterAvgDto(q, $"Q{q}", ratings.Count == 0 ? 0 : Math.Round(ratings.Average(), 2), status));
        }

        return new PerfSummaryDto(
            year, avg,
            currents.Count(r => r >= 4.5),
            currents.Count(r => r < 2.6),
            employees.Count, // reviews due this cycle = one per employee
            employees.Count,
            dist, byQuarter);
    }

    // ---------------- quarter generation ----------------
    private sealed record QReview(int Quarter, string Label, double Rating, int GoalProgress, string Status,
        string Reviewer, string NineBox, int OneOnOnes, IReadOnlyList<CompetencyDto> Competencies, string Summary, int YearKey, bool IsManual);

    private static QReview BuildQuarter(Employee e, QInfo q, DateOnly today, IReadOnlyList<string> competencies, IReadOnlyDictionary<string, PerformanceReview>? overrides = null)
    {
        var comps0 = competencies.Count > 0 ? competencies : DefaultCompetencies;
        var r = Rng(e.Id, q.Year * 10 + q.Quarter);
        var (cy, cq) = CurrentYearQuarter(today);

        // base rating anchored on current performance, gently improving over time + small noise
        int monthsAgo = (cy - q.Year) * 12 + (cq - q.Quarter) * 3;
        double trend = -monthsAgo / 12.0 * 0.18;            // older quarters slightly lower
        double rating = Math.Clamp(e.Performance + trend + (r.NextDouble() - 0.5) * 0.7, 1, 5);
        rating = Math.Round(rating, 1);

        var status = q.Year == cy && q.Quarter == cq ? "In review" : "Calibrated";
        var goal = (int)Math.Clamp(55 + rating * 8 + r.Next(-6, 7), 40, 100);
        var comps = comps0.Select(c => new CompetencyDto(c, (int)Math.Clamp(Math.Round(rating + (r.NextDouble() - 0.5) * 1.6), 1, 5))).ToList();
        var reviewer = string.IsNullOrWhiteSpace(e.Manager) ? "Reporting manager" : e.Manager!;
        var summary = RatingSummary(rating, e.Name.Full.Split(' ')[0]);
        bool isManual = false;

        // A manually-entered review for this quarter wins over the generated one.
        if (overrides != null && overrides.TryGetValue(Key(e.Id, q.Year, q.Quarter), out var ov))
        {
            rating = Math.Round((double)ov.Rating, 1);
            goal = Math.Clamp(ov.GoalProgress, 0, 100);
            status = ov.Status;
            reviewer = string.IsNullOrWhiteSpace(ov.Reviewer) ? reviewer : ov.Reviewer!;
            summary = string.IsNullOrWhiteSpace(ov.Summary) ? summary : ov.Summary!;
            comps = ParseCompetencies(ov.Competencies, comps, comps0);
            isManual = true;
        }

        return new QReview(q.Quarter, $"Q{q.Quarter} {q.Year}", rating, goal, status, reviewer,
            NineBox(e, rating), r.Next(8, 15), comps, summary, q.Year, isManual);
    }

    private static List<CompetencyDto> ParseCompetencies(string csv, List<CompetencyDto> fallback, IReadOnlyList<string> competencies)
    {
        var parts = (csv ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != competencies.Count) return fallback;
        var list = new List<CompetencyDto>();
        for (int i = 0; i < competencies.Count; i++)
            list.Add(new CompetencyDto(competencies[i], int.TryParse(parts[i], out var v) ? Math.Clamp(v, 1, 5) : 3));
        return list;
    }

    private static List<QInfo> QuarterSeries(DateOnly joined, DateOnly today)
    {
        var (cy, cq) = CurrentYearQuarter(today);
        int startYear = Math.Max(joined.Year, cy - 2);
        int startQuarter = startYear == joined.Year ? (joined.Month - 1) / 3 + 1 : 1;

        var list = new List<QInfo>();
        int y = startYear, q = startQuarter;
        while (y < cy || (y == cy && q <= cq))
        {
            list.Add(new QInfo(y, q));
            q++; if (q > 4) { q = 1; y++; }
        }
        return list;
    }

    // ---------------- helpers ----------------
    private static double Latest(Employee e, DateOnly today, IReadOnlyList<string> competencies, IReadOnlyDictionary<string, PerformanceReview>? overrides = null)
    {
        var (cy, cq) = CurrentYearQuarter(today);
        return BuildQuarter(e, new QInfo(cy, cq), today, competencies, overrides).Rating;
    }

    private static PerfQuarterDto ToDto(QReview r) => new(
        r.Quarter, r.Label, r.Rating, r.GoalProgress, r.Status, r.Reviewer, r.NineBox, r.OneOnOnes, r.Competencies, r.Summary, r.IsManual);

    private static double Avg(IEnumerable<double> xs) { var l = xs.ToList(); return l.Count == 0 ? 0 : Math.Round(l.Average(), 2); }

    private static (int Year, int Quarter) CurrentYearQuarter(DateOnly today) => (today.Year, (today.Month - 1) / 3 + 1);
    private static DateOnly MonthStart(DateOnly d) => new(d.Year, d.Month, 1);

    private static string NineBox(Employee e, double rating)
    {
        // potential dimension is stable per employee; performance from rating.
        var pr = new Random(unchecked(BitConverter.ToInt32(e.Id.ToByteArray()) ^ 0x9b73)).NextDouble();
        var potential = pr < 0.33 ? "Low" : pr < 0.7 ? "Medium" : "High";
        var perf = rating >= 4.3 ? "High" : rating >= 3.2 ? "Medium" : "Low";
        return $"{perf} performance · {potential} potential";
    }

    private static string RatingSummary(double rating, string first) => rating switch
    {
        >= 4.5 => $"{first} consistently exceeds expectations and is a role model for the team.",
        >= 3.8 => $"{first} delivers strongly on goals with reliable, high-quality output.",
        >= 3.0 => $"{first} meets expectations; targeted stretch goals set for next quarter.",
        >= 2.5 => $"{first} is partially meeting expectations; a focused improvement plan is in place.",
        _ => $"{first} is below expectations this cycle; a formal PIP has been initiated."
    };

    private static Random Rng(Guid id, int salt)
    {
        var bytes = id.ToByteArray();
        int h = salt;
        foreach (var x in bytes) h = unchecked(h * 31 + x);
        return new Random(h);
    }
}

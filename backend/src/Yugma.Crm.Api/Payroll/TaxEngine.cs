namespace Yugma.Crm.Api.Payroll;

/// <summary>
/// Income-tax investment-declaration catalog and Old-vs-New regime tax computation.
/// New-regime slabs/params come from Postgres (payroll_settings + tax_slabs); the Old-regime
/// statutory slabs/limits are standard constants.
/// </summary>
public static class TaxEngine
{
    // ---------------- declaration catalog ----------------
    public sealed record DeclItem(string Key, string Label);
    public sealed record DeclSection(string Code, string Label, decimal? Limit, IReadOnlyList<DeclItem> Items);

    public static readonly IReadOnlyList<DeclSection> Catalog = new[]
    {
        new DeclSection("80C", "Section 80C", 150_000m, new[]
        {
            new DeclItem("80c.elss", "Equity Linked Savings Scheme (ELSS)"),
            new DeclItem("80c.ppf", "Public Provident Fund (PPF)"),
            new DeclItem("80c.lic", "Life Insurance Premium (LIC)"),
            new DeclItem("80c.children_edu", "Children Education Fees"),
            new DeclItem("80c.housing_principal", "Housing Loan Principal Repayment"),
            new DeclItem("80c.fd_5yr", "5-Year Tax-saver Fixed Deposit"),
            new DeclItem("80c.nsc", "National Savings Certificate (NSC)"),
            new DeclItem("80c.sukanya", "Sukanya Samriddhi Yojana")
        }),
        new DeclSection("80CCD1B", "Section 80CCD(1B) — NPS", 50_000m, new[]
        {
            new DeclItem("80ccd1b.nps", "National Pension System (additional)")
        }),
        new DeclSection("80D", "Section 80D — Medical Insurance", 50_000m, new[]
        {
            new DeclItem("80d.self_family", "Health insurance — self & family"),
            new DeclItem("80d.parents", "Health insurance — parents"),
            new DeclItem("80d.checkup", "Preventive health check-up")
        }),
        new DeclSection("24B", "Section 24(b) — Home Loan Interest", 200_000m, new[]
        {
            new DeclItem("24b.home_loan_interest", "Interest on housing loan")
        }),
        new DeclSection("80E", "Section 80E — Education Loan", null, new[]
        {
            new DeclItem("80e.interest", "Interest on education loan")
        }),
        new DeclSection("80G", "Section 80G — Donations", null, new[]
        {
            new DeclItem("80g.donations", "Eligible donations")
        }),
        new DeclSection("HRA", "House Rent Allowance (HRA)", null, new[]
        {
            new DeclItem("hra.rent_annual", "Total annual rent paid"),
            new DeclItem("hra.metro", "Metro city? (1 = yes, 0 = no)")
        })
    };

    // ---------------- regime parameters ----------------
    public sealed record RegimeParams(string Name, decimal StandardDeduction, decimal RebateTaxableLimit, decimal CessPct,
        IReadOnlyList<(decimal UpTo, decimal Rate)> Slabs);

    /// <summary>Old-regime statutory slabs (FY) — 0/5/20/30% with a ₹5L 87A rebate and a ₹50k standard deduction.</summary>
    public static RegimeParams OldRegime() => new("Old", 50_000m, 500_000m, 0.04m, new (decimal, decimal)[]
    {
        (250_000m, 0.00m), (500_000m, 0.05m), (1_000_000m, 0.20m), (99_999_999m, 0.30m)
    });

    // ---------------- computation ----------------
    public sealed record DeductionLine(string Label, decimal Amount);
    public sealed record RegimeResult(string Regime, decimal GrossIncome, decimal StandardDeduction,
        decimal TotalDeductions, decimal TaxableIncome, decimal Tax,
        IReadOnlyList<DeductionLine> DeductionLines);

    /// <summary>New regime: only the standard deduction applies; everything else is taxed.</summary>
    public static RegimeResult ComputeNew(decimal grossAnnual, RegimeParams p)
    {
        var taxable = Math.Max(0, grossAnnual - p.StandardDeduction);
        return new RegimeResult("New", grossAnnual, p.StandardDeduction, p.StandardDeduction, taxable,
            Tax(taxable, p), new[] { new DeductionLine("Standard deduction", p.StandardDeduction) });
    }

    /// <summary>Old regime: standard deduction + Chapter VI-A deductions + HRA exemption from the declaration.</summary>
    public static RegimeResult ComputeOld(decimal grossAnnual, decimal basicAnnual, RegimeParams p,
        IReadOnlyDictionary<string, decimal> decl)
    {
        decimal Sum(params string[] keys) => keys.Sum(k => decl.TryGetValue(k, out var v) ? v : 0m);

        var ded80C = Math.Min(150_000m, Sum("80c.elss", "80c.ppf", "80c.lic", "80c.children_edu", "80c.housing_principal", "80c.fd_5yr", "80c.nsc", "80c.sukanya"));
        var ded80CCD1B = Math.Min(50_000m, Sum("80ccd1b.nps"));
        var ded80D = Math.Min(50_000m, Sum("80d.self_family", "80d.parents", "80d.checkup"));
        var ded24B = Math.Min(200_000m, Sum("24b.home_loan_interest"));
        var ded80E = Sum("80e.interest");
        var ded80G = Sum("80g.donations");
        var hraExempt = HraExemption(Sum("hra.rent_annual"), basicAnnual, Sum("hra.metro") >= 1);

        var lines = new List<DeductionLine>
        {
            new("Standard deduction", p.StandardDeduction),
            new("HRA exemption", hraExempt),
            new("80C investments", ded80C),
            new("80CCD(1B) NPS", ded80CCD1B),
            new("80D medical insurance", ded80D),
            new("24(b) home-loan interest", ded24B),
            new("80E education-loan interest", ded80E),
            new("80G donations", ded80G)
        }.Where(l => l.Amount > 0).ToList();

        var totalDed = p.StandardDeduction + hraExempt + ded80C + ded80CCD1B + ded80D + ded24B + ded80E + ded80G;
        var taxable = Math.Max(0, grossAnnual - totalDed);
        return new RegimeResult("Old", grossAnnual, p.StandardDeduction, totalDed, taxable, Tax(taxable, p), lines);
    }

    /// <summary>HRA exemption = least of (HRA received, rent − 10% basic, 50%/40% of basic). We approximate HRA received as 50% of basic.</summary>
    private static decimal HraExemption(decimal rentAnnual, decimal basicAnnual, bool metro)
    {
        if (rentAnnual <= 0 || basicAnnual <= 0) return 0;
        var hraReceived = basicAnnual * 0.50m;
        var rentMinus10 = Math.Max(0, rentAnnual - 0.10m * basicAnnual);
        var pctBasic = (metro ? 0.50m : 0.40m) * basicAnnual;
        return Math.Max(0, Math.Min(hraReceived, Math.Min(rentMinus10, pctBasic)));
    }

    private static decimal Tax(decimal taxable, RegimeParams p)
    {
        if (taxable <= p.RebateTaxableLimit) return 0m;            // 87A rebate
        decimal tax = 0m, lower = 0m;
        foreach (var (upTo, rate) in p.Slabs)
        {
            if (taxable > lower) { tax += (Math.Min(taxable, upTo) - lower) * rate; lower = upTo; }
            else break;
        }
        return Math.Round(tax * (1 + p.CessPct), 0, MidpointRounding.AwayFromZero);
    }
}

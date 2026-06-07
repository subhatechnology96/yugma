namespace Yugma.Crm.Domain.Reference;

// Global reference/lookup data — intentionally NOT Entity<Guid>, so the per-tenant
// query filter does not apply (these tables are shared / queried pre-authentication).

/// <summary>A workspace/tenant. The display name lives here instead of being hardcoded.</summary>
public sealed class Tenant
{
    public Guid Id { get; set; }
    public string Name { get; set; } = default!;
    public string Slug { get; set; } = default!;
}

/// <summary>Access-control role catalog (Owner/Admin/Manager/Member) with its permission list.</summary>
public sealed class RoleDefinition
{
    public string Key { get; set; } = default!;          // PK, e.g. "Admin"
    public string Label { get; set; } = default!;
    public string Description { get; set; } = default!;
    public string Tone { get; set; } = "neutral";
    public int Rank { get; set; }                         // ordering / seniority
    public bool Assignable { get; set; } = true;          // false for Owner (transfer-ownership only)
    public string[] Permissions { get; set; } = [];       // Npgsql maps string[] -> text[]
}

/// <summary>Hierarchy band catalog (L1 Trainee … L10 CEO).</summary>
public sealed class HierarchyLevel
{
    public int Rank { get; set; }                         // PK, 1..10
    public string Code { get; set; } = default!;          // "L1"
    public string Title { get; set; } = default!;         // "Trainee"
    public string Description { get; set; } = default!;
}

/// <summary>Leave type catalog with annual entitlement (working days).</summary>
public sealed class LeaveTypeConfig
{
    public string Code { get; set; } = default!;          // PK = LeaveType enum name, e.g. "Casual"
    public string Label { get; set; } = default!;
    public double AnnualEntitlement { get; set; }
    public int SortOrder { get; set; }
}

/// <summary>Salary-structure &amp; statutory rules for payroll (single row). Replaces hardcoded constants.</summary>
public sealed class PayrollSetting
{
    public int Id { get; set; } = 1;                      // single-row config
    public decimal BasicPctOfGross { get; set; }          // e.g. 0.40
    public decimal HraPctOfBasic { get; set; }            // e.g. 0.50
    public decimal Conveyance { get; set; }               // monthly flat, e.g. 1600
    public decimal PfPctOfBasic { get; set; }             // e.g. 0.12
    public decimal ProfessionalTax { get; set; }          // monthly flat, e.g. 200
    public decimal EsiGrossThreshold { get; set; }        // e.g. 21000
    public decimal EsiEmployeePct { get; set; }           // e.g. 0.0075
    public decimal EsiEmployerPct { get; set; }           // e.g. 0.0325
    public decimal StandardDeduction { get; set; }        // annual, e.g. 75000
    public decimal RebateTaxableLimit { get; set; }       // taxable <= this → nil tax, e.g. 700000
    public decimal CessPct { get; set; }                  // e.g. 0.04

    // Payslip branding (configurable — shown at the top of every payslip).
    public string CompanyName { get; set; } = "Subha Technology";
    public string CompanyLegalName { get; set; } = "Subha Technology Pvt. Ltd.";
    public string? CompanyAddress { get; set; }
}

/// <summary>Progressive income-tax slabs (new regime). One row per slab.</summary>
public sealed class TaxSlab
{
    public int Id { get; set; }
    public decimal UpTo { get; set; }                     // upper bound of the slab (top slab uses a very large value)
    public decimal Rate { get; set; }                     // e.g. 0.05
    public int SortOrder { get; set; }
}

/// <summary>Performance-review competency catalog (Delivery, Collaboration, …).</summary>
public sealed class CompetencyDefinition
{
    public string Name { get; set; } = default!;          // PK
    public int SortOrder { get; set; }
}

/// <summary>Company holiday calendar. Type = "Public" (government / mandatory) or "Optional" (RH).</summary>
public sealed class Holiday
{
    public int Id { get; set; }
    public DateOnly Date { get; set; }
    public string Name { get; set; } = default!;
    public string Type { get; set; } = "Public";          // "Public" | "Optional"
    public int Year { get; set; }
}

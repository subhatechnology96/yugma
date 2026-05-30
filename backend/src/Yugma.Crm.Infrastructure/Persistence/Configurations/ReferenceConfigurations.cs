using Yugma.Crm.Domain.Reference;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class TenantConfiguration : IEntityTypeConfiguration<Tenant>
{
    public void Configure(EntityTypeBuilder<Tenant> b)
    {
        b.ToTable("tenants");
        b.HasKey(e => e.Id);
        b.Property(e => e.Name).HasMaxLength(160).IsRequired();
        b.Property(e => e.Slug).HasMaxLength(80).IsRequired();
        b.HasIndex(e => e.Slug).IsUnique();
    }
}

internal sealed class RoleDefinitionConfiguration : IEntityTypeConfiguration<RoleDefinition>
{
    public void Configure(EntityTypeBuilder<RoleDefinition> b)
    {
        b.ToTable("role_definitions");
        b.HasKey(e => e.Key);
        b.Property(e => e.Key).HasMaxLength(50);
        b.Property(e => e.Label).HasMaxLength(80).IsRequired();
        b.Property(e => e.Description).HasMaxLength(400).IsRequired();
        b.Property(e => e.Tone).HasMaxLength(30);
        b.Property(e => e.Permissions).HasColumnType("text[]");
    }
}

internal sealed class HierarchyLevelConfiguration : IEntityTypeConfiguration<HierarchyLevel>
{
    public void Configure(EntityTypeBuilder<HierarchyLevel> b)
    {
        b.ToTable("hierarchy_levels");
        b.HasKey(e => e.Rank);
        b.Property(e => e.Rank).ValueGeneratedNever();
        b.Property(e => e.Code).HasMaxLength(8).IsRequired();
        b.Property(e => e.Title).HasMaxLength(60).IsRequired();
        b.Property(e => e.Description).HasMaxLength(400).IsRequired();
    }
}

internal sealed class LeaveTypeConfigConfiguration : IEntityTypeConfiguration<LeaveTypeConfig>
{
    public void Configure(EntityTypeBuilder<LeaveTypeConfig> b)
    {
        b.ToTable("leave_types");
        b.HasKey(e => e.Code);
        b.Property(e => e.Code).HasMaxLength(40);
        b.Property(e => e.Label).HasMaxLength(80).IsRequired();
    }
}

internal sealed class PayrollSettingConfiguration : IEntityTypeConfiguration<PayrollSetting>
{
    public void Configure(EntityTypeBuilder<PayrollSetting> b)
    {
        b.ToTable("payroll_settings");
        b.HasKey(e => e.Id);
        b.Property(e => e.Id).ValueGeneratedNever();
        foreach (var p in new[] { nameof(PayrollSetting.BasicPctOfGross), nameof(PayrollSetting.HraPctOfBasic),
                 nameof(PayrollSetting.Conveyance), nameof(PayrollSetting.PfPctOfBasic), nameof(PayrollSetting.ProfessionalTax),
                 nameof(PayrollSetting.EsiGrossThreshold), nameof(PayrollSetting.EsiEmployeePct), nameof(PayrollSetting.EsiEmployerPct),
                 nameof(PayrollSetting.StandardDeduction), nameof(PayrollSetting.RebateTaxableLimit), nameof(PayrollSetting.CessPct) })
            b.Property(p).HasColumnType("numeric(18,4)");
    }
}

internal sealed class TaxSlabConfiguration : IEntityTypeConfiguration<TaxSlab>
{
    public void Configure(EntityTypeBuilder<TaxSlab> b)
    {
        b.ToTable("tax_slabs");
        b.HasKey(e => e.Id);
        b.Property(e => e.UpTo).HasColumnType("numeric(18,2)");
        b.Property(e => e.Rate).HasColumnType("numeric(6,4)");
    }
}

internal sealed class CompetencyDefinitionConfiguration : IEntityTypeConfiguration<CompetencyDefinition>
{
    public void Configure(EntityTypeBuilder<CompetencyDefinition> b)
    {
        b.ToTable("competencies");
        b.HasKey(e => e.Name);
        b.Property(e => e.Name).HasMaxLength(60);
    }
}

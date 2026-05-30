using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Yugma.Crm.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPayrollSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "payroll_settings",
                schema: "yugma",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    BasicPctOfGross = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    HraPctOfBasic = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    Conveyance = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    PfPctOfBasic = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    ProfessionalTax = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    EsiGrossThreshold = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    EsiEmployeePct = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    EsiEmployerPct = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    StandardDeduction = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    RebateTaxableLimit = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    CessPct = table.Column<decimal>(type: "numeric(18,4)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payroll_settings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "tax_slabs",
                schema: "yugma",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UpTo = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Rate = table.Column<decimal>(type: "numeric(6,4)", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tax_slabs", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "payroll_settings",
                schema: "yugma");

            migrationBuilder.DropTable(
                name: "tax_slabs",
                schema: "yugma");
        }
    }
}

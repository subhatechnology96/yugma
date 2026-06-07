using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Yugma.Crm.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPayslips : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Month",
                schema: "yugma",
                table: "payroll_runs",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                schema: "yugma",
                table: "payroll_runs",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Year",
                schema: "yugma",
                table: "payroll_runs",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "payslips",
                schema: "yugma",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RunId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Department = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Designation = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false),
                    Month = table.Column<int>(type: "integer", nullable: false),
                    PayableDays = table.Column<int>(type: "integer", nullable: false),
                    LopDays = table.Column<int>(type: "integer", nullable: false),
                    Basic = table.Column<decimal>(type: "numeric(14,2)", nullable: false),
                    Hra = table.Column<decimal>(type: "numeric(14,2)", nullable: false),
                    Special = table.Column<decimal>(type: "numeric(14,2)", nullable: false),
                    Conveyance = table.Column<decimal>(type: "numeric(14,2)", nullable: false),
                    Bonus = table.Column<decimal>(type: "numeric(14,2)", nullable: false),
                    OtherEarnings = table.Column<decimal>(type: "numeric(14,2)", nullable: false),
                    Pf = table.Column<decimal>(type: "numeric(14,2)", nullable: false),
                    Esi = table.Column<decimal>(type: "numeric(14,2)", nullable: false),
                    Pt = table.Column<decimal>(type: "numeric(14,2)", nullable: false),
                    Tds = table.Column<decimal>(type: "numeric(14,2)", nullable: false),
                    OtherDeductions = table.Column<decimal>(type: "numeric(14,2)", nullable: false),
                    LopDeduction = table.Column<decimal>(type: "numeric(14,2)", nullable: false),
                    Gross = table.Column<decimal>(type: "numeric(14,2)", nullable: false),
                    TotalDeductions = table.Column<decimal>(type: "numeric(14,2)", nullable: false),
                    Net = table.Column<decimal>(type: "numeric(14,2)", nullable: false),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Edited = table.Column<bool>(type: "boolean", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "bytea", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payslips", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_payslips_RunId_EmployeeId",
                schema: "yugma",
                table: "payslips",
                columns: new[] { "RunId", "EmployeeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_payslips_TenantId_RunId",
                schema: "yugma",
                table: "payslips",
                columns: new[] { "TenantId", "RunId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "payslips",
                schema: "yugma");

            migrationBuilder.DropColumn(
                name: "Month",
                schema: "yugma",
                table: "payroll_runs");

            migrationBuilder.DropColumn(
                name: "Notes",
                schema: "yugma",
                table: "payroll_runs");

            migrationBuilder.DropColumn(
                name: "Year",
                schema: "yugma",
                table: "payroll_runs");
        }
    }
}

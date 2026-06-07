using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Yugma.Crm.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPayslipBrandingAndEmployeeStatutory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CompanyAddress",
                schema: "yugma",
                table: "payroll_settings",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CompanyLegalName",
                schema: "yugma",
                table: "payroll_settings",
                type: "character varying(160)",
                maxLength: 160,
                nullable: false,
                defaultValue: "Subha Technology Pvt. Ltd.");

            migrationBuilder.AddColumn<string>(
                name: "CompanyName",
                schema: "yugma",
                table: "payroll_settings",
                type: "character varying(120)",
                maxLength: 120,
                nullable: false,
                defaultValue: "Subha Technology");

            migrationBuilder.AddColumn<string>(
                name: "BankAccount",
                schema: "yugma",
                table: "employees",
                type: "character varying(34)",
                maxLength: 34,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BankName",
                schema: "yugma",
                table: "employees",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Gender",
                schema: "yugma",
                table: "employees",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Pan",
                schema: "yugma",
                table: "employees",
                type: "character varying(15)",
                maxLength: 15,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PfNumber",
                schema: "yugma",
                table: "employees",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Uan",
                schema: "yugma",
                table: "employees",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CompanyAddress",
                schema: "yugma",
                table: "payroll_settings");

            migrationBuilder.DropColumn(
                name: "CompanyLegalName",
                schema: "yugma",
                table: "payroll_settings");

            migrationBuilder.DropColumn(
                name: "CompanyName",
                schema: "yugma",
                table: "payroll_settings");

            migrationBuilder.DropColumn(
                name: "BankAccount",
                schema: "yugma",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "BankName",
                schema: "yugma",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "Gender",
                schema: "yugma",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "Pan",
                schema: "yugma",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "PfNumber",
                schema: "yugma",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "Uan",
                schema: "yugma",
                table: "employees");
        }
    }
}

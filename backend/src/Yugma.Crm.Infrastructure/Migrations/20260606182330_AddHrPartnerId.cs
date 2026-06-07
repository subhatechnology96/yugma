using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Yugma.Crm.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddHrPartnerId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "HrPartner",
                schema: "yugma",
                table: "employees",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "hr_partner_id",
                schema: "yugma",
                table: "employees",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_employees_TenantId_hr_partner_id",
                schema: "yugma",
                table: "employees",
                columns: new[] { "TenantId", "hr_partner_id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_employees_TenantId_hr_partner_id",
                schema: "yugma",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "HrPartner",
                schema: "yugma",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "hr_partner_id",
                schema: "yugma",
                table: "employees");
        }
    }
}

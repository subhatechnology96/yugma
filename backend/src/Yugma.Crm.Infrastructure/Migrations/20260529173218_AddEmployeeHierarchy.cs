using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Yugma.Crm.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeHierarchy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "band",
                schema: "yugma",
                table: "employees",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "manager_id",
                schema: "yugma",
                table: "employees",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_employees_TenantId_manager_id",
                schema: "yugma",
                table: "employees",
                columns: new[] { "TenantId", "manager_id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_employees_TenantId_manager_id",
                schema: "yugma",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "band",
                schema: "yugma",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "manager_id",
                schema: "yugma",
                table: "employees");
        }
    }
}

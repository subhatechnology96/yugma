using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Yugma.Crm.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddLeaveDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "AppliedOn",
                schema: "yugma",
                table: "leave_requests",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1));

            migrationBuilder.AddColumn<string>(
                name: "Approver",
                schema: "yugma",
                table: "leave_requests",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DecidedAt",
                schema: "yugma",
                table: "leave_requests",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DecidedBy",
                schema: "yugma",
                table: "leave_requests",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_leave_requests_TenantId_Employee",
                schema: "yugma",
                table: "leave_requests",
                columns: new[] { "TenantId", "Employee" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_leave_requests_TenantId_Employee",
                schema: "yugma",
                table: "leave_requests");

            migrationBuilder.DropColumn(
                name: "AppliedOn",
                schema: "yugma",
                table: "leave_requests");

            migrationBuilder.DropColumn(
                name: "Approver",
                schema: "yugma",
                table: "leave_requests");

            migrationBuilder.DropColumn(
                name: "DecidedAt",
                schema: "yugma",
                table: "leave_requests");

            migrationBuilder.DropColumn(
                name: "DecidedBy",
                schema: "yugma",
                table: "leave_requests");
        }
    }
}

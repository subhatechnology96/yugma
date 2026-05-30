using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Yugma.Crm.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAttendanceEmployeeId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "employee_id",
                schema: "yugma",
                table: "attendance_records",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "IX_attendance_records_TenantId_Date_employee_id",
                schema: "yugma",
                table: "attendance_records",
                columns: new[] { "TenantId", "Date", "employee_id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_attendance_records_TenantId_Date_employee_id",
                schema: "yugma",
                table: "attendance_records");

            migrationBuilder.DropColumn(
                name: "employee_id",
                schema: "yugma",
                table: "attendance_records");
        }
    }
}

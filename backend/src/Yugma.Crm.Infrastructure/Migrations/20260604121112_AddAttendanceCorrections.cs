using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Yugma.Crm.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAttendanceCorrections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "attendance_corrections",
                schema: "yugma",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    RequestedStatus = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    RequestedInTime = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: true),
                    RequestedOutTime = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: true),
                    Reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Approver = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    RequestedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DecidedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DecidedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    DecisionNote = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "bytea", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_attendance_corrections", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_attendance_corrections_TenantId_EmployeeId_Date",
                schema: "yugma",
                table: "attendance_corrections",
                columns: new[] { "TenantId", "EmployeeId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_attendance_corrections_TenantId_Status",
                schema: "yugma",
                table: "attendance_corrections",
                columns: new[] { "TenantId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "attendance_corrections",
                schema: "yugma");
        }
    }
}

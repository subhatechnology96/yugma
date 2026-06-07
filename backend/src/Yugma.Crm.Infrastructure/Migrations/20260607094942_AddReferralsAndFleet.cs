using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Yugma.Crm.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddReferralsAndFleet : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "hr_referrals",
                schema: "yugma",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Referrer = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CandidateName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CandidateEmail = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    Position = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Department = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ReferredAt = table.Column<DateOnly>(type: "date", nullable: false),
                    BonusAmount = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    BonusPaid = table.Column<bool>(type: "boolean", nullable: false),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "bytea", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_hr_referrals", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "hr_vehicles",
                schema: "yugma",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Plate = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    AssignedTo = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    FuelType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    OdometerKm = table.Column<int>(type: "integer", nullable: false),
                    AcquiredAt = table.Column<DateOnly>(type: "date", nullable: false),
                    NextServiceAt = table.Column<DateOnly>(type: "date", nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "bytea", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_hr_vehicles", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_hr_referrals_TenantId_Status",
                schema: "yugma",
                table: "hr_referrals",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_hr_vehicles_TenantId_Plate",
                schema: "yugma",
                table: "hr_vehicles",
                columns: new[] { "TenantId", "Plate" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "hr_referrals",
                schema: "yugma");

            migrationBuilder.DropTable(
                name: "hr_vehicles",
                schema: "yugma");
        }
    }
}

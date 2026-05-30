using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Yugma.Crm.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRecruitmentDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Email",
                schema: "yugma",
                table: "candidates",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ExpectedCtcLakhs",
                schema: "yugma",
                table: "candidates",
                type: "numeric(10,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "ExperienceYears",
                schema: "yugma",
                table: "candidates",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateOnly>(
                name: "LastActivityAt",
                schema: "yugma",
                table: "candidates",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1));

            migrationBuilder.AddColumn<string>(
                name: "Location",
                schema: "yugma",
                table: "candidates",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Owner",
                schema: "yugma",
                table: "candidates",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "job_openings",
                schema: "yugma",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Department = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Location = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    EmploymentType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Openings = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    HiringManager = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    BudgetCtcLakhs = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    PostedAt = table.Column<DateOnly>(type: "date", nullable: false),
                    Priority = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "bytea", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_job_openings", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_job_openings_TenantId_Status",
                schema: "yugma",
                table: "job_openings",
                columns: new[] { "TenantId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "job_openings",
                schema: "yugma");

            migrationBuilder.DropColumn(
                name: "Email",
                schema: "yugma",
                table: "candidates");

            migrationBuilder.DropColumn(
                name: "ExpectedCtcLakhs",
                schema: "yugma",
                table: "candidates");

            migrationBuilder.DropColumn(
                name: "ExperienceYears",
                schema: "yugma",
                table: "candidates");

            migrationBuilder.DropColumn(
                name: "LastActivityAt",
                schema: "yugma",
                table: "candidates");

            migrationBuilder.DropColumn(
                name: "Location",
                schema: "yugma",
                table: "candidates");

            migrationBuilder.DropColumn(
                name: "Owner",
                schema: "yugma",
                table: "candidates");
        }
    }
}

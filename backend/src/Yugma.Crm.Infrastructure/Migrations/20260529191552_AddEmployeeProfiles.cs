using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Yugma.Crm.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeProfiles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "employee_profiles",
                schema: "yugma",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    PersonalEmail = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    DateOfBirth = table.Column<DateOnly>(type: "date", nullable: false),
                    Worksite = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Grade = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    BloodGroup = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    MaritalStatus = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Address = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    EmergencyName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    EmergencyRelation = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    EmergencyPhone = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    PanMasked = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    AadhaarMasked = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    BankName = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    BankAccountMasked = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Uan = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    About = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "bytea", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_employee_profiles", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_employee_profiles_TenantId_EmployeeId",
                schema: "yugma",
                table: "employee_profiles",
                columns: new[] { "TenantId", "EmployeeId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "employee_profiles",
                schema: "yugma");
        }
    }
}

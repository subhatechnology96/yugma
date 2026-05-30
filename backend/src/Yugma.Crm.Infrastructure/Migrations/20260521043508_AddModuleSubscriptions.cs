using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Yugma.Crm.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddModuleSubscriptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "module_subscriptions",
                schema: "yugma",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ModuleKey = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ModuleName = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Icon = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Plan = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    MonthlyPrice = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    BillingCycle = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Seats = table.Column<int>(type: "integer", nullable: false),
                    SeatsUsed = table.Column<int>(type: "integer", nullable: false),
                    StartedAt = table.Column<DateOnly>(type: "date", nullable: false),
                    RenewsAt = table.Column<DateOnly>(type: "date", nullable: false),
                    Features = table.Column<string[]>(type: "text[]", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "bytea", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_module_subscriptions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_module_subscriptions_TenantId_ModuleKey",
                schema: "yugma",
                table: "module_subscriptions",
                columns: new[] { "TenantId", "ModuleKey" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "module_subscriptions",
                schema: "yugma");
        }
    }
}

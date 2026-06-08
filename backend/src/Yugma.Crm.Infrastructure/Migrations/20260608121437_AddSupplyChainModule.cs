using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Yugma.Crm.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSupplyChainModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "sc_engineering_changes",
                schema: "yugma",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Reference = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Product = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ChangeType = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    Stage = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    Responsible = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    Description = table.Column<string>(type: "text", nullable: true),
                    EffectiveDate = table.Column<DateOnly>(type: "date", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "bytea", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sc_engineering_changes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "sc_maintenance_requests",
                schema: "yugma",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Reference = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Equipment = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Stage = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    Responsible = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    Category = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    ScheduledDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Duration = table.Column<decimal>(type: "numeric(8,2)", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "bytea", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sc_maintenance_requests", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "sc_manufacturing_orders",
                schema: "yugma",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Reference = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Product = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric(14,2)", nullable: false),
                    Uom = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    Stage = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Responsible = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    ScheduledDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Source = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "bytea", nullable: false),
                    Components = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sc_manufacturing_orders", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "sc_purchase_orders",
                schema: "yugma",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Number = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Vendor = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    VendorEmail = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    OrderDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ExpectedDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Responsible = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    UntaxedAmount = table.Column<decimal>(type: "numeric(16,2)", nullable: false),
                    TaxAmount = table.Column<decimal>(type: "numeric(16,2)", nullable: false),
                    Total = table.Column<decimal>(type: "numeric(16,2)", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "bytea", nullable: false),
                    Lines = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sc_purchase_orders", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "sc_quality_checks",
                schema: "yugma",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Reference = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Product = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CheckType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ControlPoint = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    SourceDocument = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    Responsible = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    Measure = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "bytea", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sc_quality_checks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "sc_stock_items",
                schema: "yugma",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Sku = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Category = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Location = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    OnHand = table.Column<decimal>(type: "numeric(14,2)", nullable: false),
                    Reserved = table.Column<decimal>(type: "numeric(14,2)", nullable: false),
                    ReorderPoint = table.Column<decimal>(type: "numeric(14,2)", nullable: false),
                    UnitCost = table.Column<decimal>(type: "numeric(14,2)", nullable: false),
                    Uom = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "bytea", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sc_stock_items", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "sc_stock_moves",
                schema: "yugma",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Reference = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    MoveType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Product = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric(14,2)", nullable: false),
                    SourceLocation = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    DestLocation = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Partner = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ScheduledDate = table.Column<DateOnly>(type: "date", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "bytea", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sc_stock_moves", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_sc_engineering_changes_TenantId_Reference",
                schema: "yugma",
                table: "sc_engineering_changes",
                columns: new[] { "TenantId", "Reference" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_sc_engineering_changes_TenantId_Stage",
                schema: "yugma",
                table: "sc_engineering_changes",
                columns: new[] { "TenantId", "Stage" });

            migrationBuilder.CreateIndex(
                name: "IX_sc_maintenance_requests_TenantId_Reference",
                schema: "yugma",
                table: "sc_maintenance_requests",
                columns: new[] { "TenantId", "Reference" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_sc_maintenance_requests_TenantId_Stage",
                schema: "yugma",
                table: "sc_maintenance_requests",
                columns: new[] { "TenantId", "Stage" });

            migrationBuilder.CreateIndex(
                name: "IX_sc_manufacturing_orders_TenantId_Reference",
                schema: "yugma",
                table: "sc_manufacturing_orders",
                columns: new[] { "TenantId", "Reference" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_sc_manufacturing_orders_TenantId_Stage",
                schema: "yugma",
                table: "sc_manufacturing_orders",
                columns: new[] { "TenantId", "Stage" });

            migrationBuilder.CreateIndex(
                name: "IX_sc_purchase_orders_TenantId_Number",
                schema: "yugma",
                table: "sc_purchase_orders",
                columns: new[] { "TenantId", "Number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_sc_purchase_orders_TenantId_Status",
                schema: "yugma",
                table: "sc_purchase_orders",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_sc_quality_checks_TenantId_Reference",
                schema: "yugma",
                table: "sc_quality_checks",
                columns: new[] { "TenantId", "Reference" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_sc_quality_checks_TenantId_Status",
                schema: "yugma",
                table: "sc_quality_checks",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_sc_stock_items_TenantId_Category",
                schema: "yugma",
                table: "sc_stock_items",
                columns: new[] { "TenantId", "Category" });

            migrationBuilder.CreateIndex(
                name: "IX_sc_stock_items_TenantId_Sku",
                schema: "yugma",
                table: "sc_stock_items",
                columns: new[] { "TenantId", "Sku" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_sc_stock_moves_TenantId_MoveType_Status",
                schema: "yugma",
                table: "sc_stock_moves",
                columns: new[] { "TenantId", "MoveType", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_sc_stock_moves_TenantId_Reference",
                schema: "yugma",
                table: "sc_stock_moves",
                columns: new[] { "TenantId", "Reference" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "sc_engineering_changes",
                schema: "yugma");

            migrationBuilder.DropTable(
                name: "sc_maintenance_requests",
                schema: "yugma");

            migrationBuilder.DropTable(
                name: "sc_manufacturing_orders",
                schema: "yugma");

            migrationBuilder.DropTable(
                name: "sc_purchase_orders",
                schema: "yugma");

            migrationBuilder.DropTable(
                name: "sc_quality_checks",
                schema: "yugma");

            migrationBuilder.DropTable(
                name: "sc_stock_items",
                schema: "yugma");

            migrationBuilder.DropTable(
                name: "sc_stock_moves",
                schema: "yugma");
        }
    }
}

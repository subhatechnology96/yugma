using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Yugma.Crm.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSalesModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "sales_opportunities",
                schema: "yugma",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Stage = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Customer = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ContactName = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    Email = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    Phone = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Salesperson = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    ExpectedRevenue = table.Column<decimal>(type: "numeric(16,2)", nullable: false),
                    Probability = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    ExpectedClosing = table.Column<DateOnly>(type: "date", nullable: true),
                    Source = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    Description = table.Column<string>(type: "text", nullable: true),
                    tags = table.Column<string[]>(type: "text[]", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "bytea", nullable: false),
                    Activities = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sales_opportunities", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "sales_products",
                schema: "yugma",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Category = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    UnitPrice = table.Column<decimal>(type: "numeric(14,2)", nullable: false),
                    TaxPercent = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    OnHand = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    Uom = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Active = table.Column<bool>(type: "boolean", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "bytea", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sales_products", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "sales_quotations",
                schema: "yugma",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Number = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Customer = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CustomerEmail = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    CustomerAddress = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    OrderDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ExpiryDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Pricelist = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    PaymentTerms = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Salesperson = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    OpportunityId = table.Column<Guid>(type: "uuid", nullable: true),
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
                    table.PrimaryKey("PK_sales_quotations", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_sales_opportunities_TenantId_Code",
                schema: "yugma",
                table: "sales_opportunities",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_sales_opportunities_TenantId_Stage",
                schema: "yugma",
                table: "sales_opportunities",
                columns: new[] { "TenantId", "Stage" });

            migrationBuilder.CreateIndex(
                name: "IX_sales_products_TenantId_Category",
                schema: "yugma",
                table: "sales_products",
                columns: new[] { "TenantId", "Category" });

            migrationBuilder.CreateIndex(
                name: "IX_sales_products_TenantId_Code",
                schema: "yugma",
                table: "sales_products",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_sales_quotations_TenantId_Number",
                schema: "yugma",
                table: "sales_quotations",
                columns: new[] { "TenantId", "Number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_sales_quotations_TenantId_Status",
                schema: "yugma",
                table: "sales_quotations",
                columns: new[] { "TenantId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "sales_opportunities",
                schema: "yugma");

            migrationBuilder.DropTable(
                name: "sales_products",
                schema: "yugma");

            migrationBuilder.DropTable(
                name: "sales_quotations",
                schema: "yugma");
        }
    }
}

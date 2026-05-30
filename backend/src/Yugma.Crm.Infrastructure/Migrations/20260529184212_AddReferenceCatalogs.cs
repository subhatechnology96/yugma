using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Yugma.Crm.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddReferenceCatalogs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "hierarchy_levels",
                schema: "yugma",
                columns: table => new
                {
                    Rank = table.Column<int>(type: "integer", nullable: false),
                    Code = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Title = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Description = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_hierarchy_levels", x => x.Rank);
                });

            migrationBuilder.CreateTable(
                name: "leave_types",
                schema: "yugma",
                columns: table => new
                {
                    Code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Label = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    AnnualEntitlement = table.Column<double>(type: "double precision", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_leave_types", x => x.Code);
                });

            migrationBuilder.CreateTable(
                name: "role_definitions",
                schema: "yugma",
                columns: table => new
                {
                    Key = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Label = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Description = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    Tone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Rank = table.Column<int>(type: "integer", nullable: false),
                    Assignable = table.Column<bool>(type: "boolean", nullable: false),
                    Permissions = table.Column<string[]>(type: "text[]", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_role_definitions", x => x.Key);
                });

            migrationBuilder.CreateTable(
                name: "tenants",
                schema: "yugma",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Slug = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tenants", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_tenants_Slug",
                schema: "yugma",
                table: "tenants",
                column: "Slug",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "hierarchy_levels",
                schema: "yugma");

            migrationBuilder.DropTable(
                name: "leave_types",
                schema: "yugma");

            migrationBuilder.DropTable(
                name: "role_definitions",
                schema: "yugma");

            migrationBuilder.DropTable(
                name: "tenants",
                schema: "yugma");
        }
    }
}

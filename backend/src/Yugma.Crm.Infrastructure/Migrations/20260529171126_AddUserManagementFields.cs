using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Yugma.Crm.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserManagementFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Department",
                schema: "yugma",
                table: "app_users",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "InvitedAt",
                schema: "yugma",
                table: "app_users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "JobTitle",
                schema: "yugma",
                table: "app_users",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Department",
                schema: "yugma",
                table: "app_users");

            migrationBuilder.DropColumn(
                name: "InvitedAt",
                schema: "yugma",
                table: "app_users");

            migrationBuilder.DropColumn(
                name: "JobTitle",
                schema: "yugma",
                table: "app_users");
        }
    }
}

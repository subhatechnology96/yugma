using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Yugma.Crm.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAgentOrchestration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Depth",
                schema: "yugma",
                table: "hr_agent_runs",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "ParentRunId",
                schema: "yugma",
                table: "hr_agent_runs",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_hr_agent_runs_ParentRunId",
                schema: "yugma",
                table: "hr_agent_runs",
                column: "ParentRunId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_hr_agent_runs_ParentRunId",
                schema: "yugma",
                table: "hr_agent_runs");

            migrationBuilder.DropColumn(
                name: "Depth",
                schema: "yugma",
                table: "hr_agent_runs");

            migrationBuilder.DropColumn(
                name: "ParentRunId",
                schema: "yugma",
                table: "hr_agent_runs");
        }
    }
}

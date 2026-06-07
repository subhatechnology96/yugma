using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Yugma.Crm.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRecruitmentWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Activity",
                schema: "yugma",
                table: "candidates",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Feedback",
                schema: "yugma",
                table: "candidates",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "InterviewScheduledAt",
                schema: "yugma",
                table: "candidates",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Interviewer",
                schema: "yugma",
                table: "candidates",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ResumeFileName",
                schema: "yugma",
                table: "candidates",
                type: "character varying(260)",
                maxLength: 260,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ResumeUrl",
                schema: "yugma",
                table: "candidates",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Activity",
                schema: "yugma",
                table: "candidates");

            migrationBuilder.DropColumn(
                name: "Feedback",
                schema: "yugma",
                table: "candidates");

            migrationBuilder.DropColumn(
                name: "InterviewScheduledAt",
                schema: "yugma",
                table: "candidates");

            migrationBuilder.DropColumn(
                name: "Interviewer",
                schema: "yugma",
                table: "candidates");

            migrationBuilder.DropColumn(
                name: "ResumeFileName",
                schema: "yugma",
                table: "candidates");

            migrationBuilder.DropColumn(
                name: "ResumeUrl",
                schema: "yugma",
                table: "candidates");
        }
    }
}

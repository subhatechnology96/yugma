using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Yugma.Crm.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationRecipientAudience : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Audience",
                schema: "yugma",
                table: "notifications",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RecipientEmail",
                schema: "yugma",
                table: "notifications",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_notifications_RecipientEmail",
                schema: "yugma",
                table: "notifications",
                column: "RecipientEmail");

            // Classify already-seeded broadcasts so they target the right audience instead of everyone.
            // Operational/finance/IT alerts → admins; pending leave approvals → HR/managers.
            migrationBuilder.Sql(
                "UPDATE yugma.notifications SET \"Audience\" = 'admin' " +
                "WHERE \"RecipientEmail\" IS NULL AND \"Audience\" IS NULL " +
                "AND \"Link\" IN ('/it/provisioning', '/accounts', '/material', '/workflow');");
            migrationBuilder.Sql(
                "UPDATE yugma.notifications SET \"Audience\" = 'hrManage' " +
                "WHERE \"RecipientEmail\" IS NULL AND \"Audience\" IS NULL AND \"Link\" = '/hr/leave';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_notifications_RecipientEmail",
                schema: "yugma",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "Audience",
                schema: "yugma",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "RecipientEmail",
                schema: "yugma",
                table: "notifications");
        }
    }
}

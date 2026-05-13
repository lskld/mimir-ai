using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Mimir.API.Migrations
{
    /// <inheritdoc />
    public partial class AddRiskProfileToRole : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AmlRisk",
                table: "Roles",
                type: "TEXT",
                nullable: false,
                defaultValue: "Medium");

            migrationBuilder.AddColumn<string>(
                name: "DocumentationRisk",
                table: "Roles",
                type: "TEXT",
                nullable: false,
                defaultValue: "Medium");

            migrationBuilder.AddColumn<string>(
                name: "FraudRisk",
                table: "Roles",
                type: "TEXT",
                nullable: false,
                defaultValue: "Medium");

            migrationBuilder.AddColumn<string>(
                name: "OperationalRisk",
                table: "Roles",
                type: "TEXT",
                nullable: false,
                defaultValue: "Medium");

            migrationBuilder.AddColumn<string>(
                name: "SanctionsRisk",
                table: "Roles",
                type: "TEXT",
                nullable: false,
                defaultValue: "Medium");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AmlRisk",
                table: "Roles");

            migrationBuilder.DropColumn(
                name: "DocumentationRisk",
                table: "Roles");

            migrationBuilder.DropColumn(
                name: "FraudRisk",
                table: "Roles");

            migrationBuilder.DropColumn(
                name: "OperationalRisk",
                table: "Roles");

            migrationBuilder.DropColumn(
                name: "SanctionsRisk",
                table: "Roles");
        }
    }
}

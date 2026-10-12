using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WebApplication1.Migrations
{
    /// <inheritdoc />
    public partial class AddMissingFaultColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "InspectionFindings",
                table: "Faults",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "IsResolved",
                table: "Faults",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ProofImagePath",
                table: "Faults",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ResolvedAt",
                table: "Faults",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "TeamDispatched",
                table: "Faults",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InspectionFindings",
                table: "Faults");

            migrationBuilder.DropColumn(
                name: "IsResolved",
                table: "Faults");

            migrationBuilder.DropColumn(
                name: "ProofImagePath",
                table: "Faults");

            migrationBuilder.DropColumn(
                name: "ResolvedAt",
                table: "Faults");

            migrationBuilder.DropColumn(
                name: "TeamDispatched",
                table: "Faults");
        }
    }
}

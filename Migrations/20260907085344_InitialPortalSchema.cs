using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace WebApplication1.Migrations
{
    /// <inheritdoc />
    public partial class InitialPortalSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Categories",
                columns: table => new
                {
                    CategoryID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CategoryName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Categories", x => x.CategoryID);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    UserID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FirstName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    LastName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CellNumber = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    EmailAddress = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PasswordHash = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    UserRole = table.Column<string>(type: "nvarchar(max)", nullable: false, defaultValue: "Resident"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.UserID);
                });

            migrationBuilder.CreateTable(
                name: "Faults",
                columns: table => new
                {
                    FaultID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TicketReference = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    UserID = table.Column<int>(type: "int", nullable: false),
                    CategoryID = table.Column<int>(type: "int", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PhysicalAddress = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Latitude = table.Column<decimal>(type: "decimal(9,6)", precision: 9, scale: 6, nullable: false),
                    Longitude = table.Column<decimal>(type: "decimal(9,6)", precision: 9, scale: 6, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false, defaultValue: "Logged"),
                    MunicipalityRefCode = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DateLogged = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastUpdated = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Faults", x => x.FaultID);
                    table.ForeignKey(
                        name: "FK_Faults_Categories_CategoryID",
                        column: x => x.CategoryID,
                        principalTable: "Categories",
                        principalColumn: "CategoryID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Faults_Users_UserID",
                        column: x => x.UserID,
                        principalTable: "Users",
                        principalColumn: "UserID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "EscalationHistories",
                columns: table => new
                {
                    EscalationID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FaultID = table.Column<int>(type: "int", nullable: false),
                    ActionTakenBy = table.Column<int>(type: "int", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DateActioned = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EscalationHistories", x => x.EscalationID);
                    table.ForeignKey(
                        name: "FK_EscalationHistories_Faults_FaultID",
                        column: x => x.FaultID,
                        principalTable: "Faults",
                        principalColumn: "FaultID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EscalationHistories_Users_ActionTakenBy",
                        column: x => x.ActionTakenBy,
                        principalTable: "Users",
                        principalColumn: "UserID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.InsertData(
                table: "Categories",
                columns: new[] { "CategoryID", "CategoryName", "Description" },
                values: new object[,]
                {
                    { 1, "Electrical & Grid", "Issues related to electricity supply, outages, and grid infrastructure." },
                    { 2, "Roads & Transport", "Issues related to roads, potholes, traffic signals, and public transport infrastructure." },
                    { 3, "Water & Sanitation", "Issues related to water supply, leaks, sewer systems, and sanitation services." },
                    { 4, "Environmental & Landfill", "Issues related to waste management, landfill sites, and environmental hazards." }
                });

            migrationBuilder.InsertData(
                table: "Users",
                columns: new[] { "UserID", "CellNumber", "CreatedAt", "EmailAddress", "FirstName", "LastName", "PasswordHash", "UserRole" },
                values: new object[,]
                {
                    { 1, "0600000001", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "admin@pa.local", "System", "Administrator", "PBKDF2$100000$bNC1ZQKWzfriG7SjvPQ64w==$yBHsOS9oJ1wGSmYo5LHNDKICJ+K/MRrZXXuBElwaKcM=", "Admin" },
                    { 2, "0600000002", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "pamember@pa.local", "Community", "Coordinator", "PBKDF2$100000$smYJmLFyX/Hz5vQEiMjE6w==$SdP2nAuPJGxc0gCOTEZP8WLHJp0UikH4JyAiimR5Hfw=", "PA Member" },
                    { 3, "0600000003", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "resident@pa.local", "Test", "Resident", "PBKDF2$100000$Za06ssLBqbuf9SHu1fVC2g==$ghLXmoUTmPvzRBtoGZj/C5+nrvFaN5I9r9mBsI/Q3Zw=", "Resident" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_EscalationHistories_ActionTakenBy",
                table: "EscalationHistories",
                column: "ActionTakenBy");

            migrationBuilder.CreateIndex(
                name: "IX_EscalationHistories_FaultID",
                table: "EscalationHistories",
                column: "FaultID");

            migrationBuilder.CreateIndex(
                name: "IX_Faults_CategoryID",
                table: "Faults",
                column: "CategoryID");

            migrationBuilder.CreateIndex(
                name: "IX_Faults_TicketReference",
                table: "Faults",
                column: "TicketReference",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Faults_UserID",
                table: "Faults",
                column: "UserID");

            migrationBuilder.CreateIndex(
                name: "IX_Users_CellNumber",
                table: "Users",
                column: "CellNumber",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EscalationHistories");

            migrationBuilder.DropTable(
                name: "Faults");

            migrationBuilder.DropTable(
                name: "Categories");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}

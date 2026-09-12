using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PetitesAnnonces.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddReportsAndSavedSearches : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Reports",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ListingId = table.Column<int>(type: "int", nullable: false),
                    ReporterUserId = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Details = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    ReviewedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    ReviewedByAdminUserId = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Reports", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Reports_Listings_ListingId",
                        column: x => x.ListingId,
                        principalTable: "Listings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SavedSearches",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    GroupId = table.Column<int>(type: "int", nullable: false),
                    Label = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    CategoryId = table.Column<int>(type: "int", nullable: true),
                    Search = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    MinPrice = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    MaxPrice = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastNotifiedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SavedSearches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SavedSearches_Groups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "Groups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Reports_ListingId",
                table: "Reports",
                column: "ListingId");

            migrationBuilder.CreateIndex(
                name: "IX_Reports_Status",
                table: "Reports",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_SavedSearches_GroupId",
                table: "SavedSearches",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_SavedSearches_UserId_GroupId",
                table: "SavedSearches",
                columns: new[] { "UserId", "GroupId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Reports");

            migrationBuilder.DropTable(
                name: "SavedSearches");
        }
    }
}

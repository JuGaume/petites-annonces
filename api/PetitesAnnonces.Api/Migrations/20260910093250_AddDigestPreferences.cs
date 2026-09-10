using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PetitesAnnonces.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDigestPreferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "EmailDigestEnabled",
                table: "GroupMemberships",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "LastDigestSentAt",
                table: "GroupMemberships",
                type: "datetimeoffset",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EmailDigestEnabled",
                table: "GroupMemberships");

            migrationBuilder.DropColumn(
                name: "LastDigestSentAt",
                table: "GroupMemberships");
        }
    }
}

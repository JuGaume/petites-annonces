using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PetitesAnnonces.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddGroupMemberPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "CanDeleteListings",
                table: "GroupMemberships",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "CanInviteMembers",
                table: "GroupMemberships",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "CanRemoveMembers",
                table: "GroupMemberships",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CanDeleteListings",
                table: "GroupMemberships");

            migrationBuilder.DropColumn(
                name: "CanInviteMembers",
                table: "GroupMemberships");

            migrationBuilder.DropColumn(
                name: "CanRemoveMembers",
                table: "GroupMemberships");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DID.Identity.Migrations
{
    /// <inheritdoc />
    public partial class AddDisplayNameAndEmail : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DisplayName",
                table: "dids",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Email",
                table: "dids",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DisplayName",
                table: "dids");

            migrationBuilder.DropColumn(
                name: "Email",
                table: "dids");
        }
    }
}

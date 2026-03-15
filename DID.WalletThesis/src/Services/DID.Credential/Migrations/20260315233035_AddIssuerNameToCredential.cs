using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DID.Credential.Migrations
{
    /// <inheritdoc />
    public partial class AddIssuerNameToCredential : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "IssuerName",
                table: "credentials",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IssuerName",
                table: "credentials");
        }
    }
}

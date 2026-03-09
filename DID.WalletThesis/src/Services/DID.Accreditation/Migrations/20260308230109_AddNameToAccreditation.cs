using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DID.Accreditation.Migrations
{
    /// <inheritdoc />
    public partial class AddNameToAccreditation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Name",
                table: "accreditations",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Name",
                table: "accreditations");
        }
    }
}

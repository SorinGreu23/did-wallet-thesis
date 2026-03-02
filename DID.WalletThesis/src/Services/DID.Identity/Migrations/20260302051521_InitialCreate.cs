using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DID.Identity.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "dids",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DID = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ControllerAddress = table.Column<string>(type: "character varying(42)", maxLength: 42, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_dids", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "key_pairs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DIDId = table.Column<Guid>(type: "uuid", nullable: false),
                    KeyType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    PublicKey = table.Column<string>(type: "text", nullable: false),
                    EncryptedPrivateKey = table.Column<string>(type: "text", nullable: false),
                    Purpose = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_key_pairs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_key_pairs_dids_DIDId",
                        column: x => x.DIDId,
                        principalTable: "dids",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_dids_DID",
                table: "dids",
                column: "DID",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_key_pairs_DIDId",
                table: "key_pairs",
                column: "DIDId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "key_pairs");

            migrationBuilder.DropTable(
                name: "dids");
        }
    }
}

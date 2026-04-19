using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DID.Accreditation.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "accreditations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AccreditationId = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    IssuerDID = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    SubjectDID = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ParentAccreditationId = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Scope = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    BlockNumber = table.Column<long>(type: "bigint", nullable: false),
                    TransactionHash = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    IssuedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RevokedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RevokedByDID = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_accreditations", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_accreditations_AccreditationId",
                table: "accreditations",
                column: "AccreditationId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "accreditations");
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DID.BlockchainSync.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SyncedBlocks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BlockNumber = table.Column<long>(type: "bigint", nullable: false),
                    BlockHash = table.Column<string>(type: "character varying(66)", maxLength: 66, nullable: false),
                    BlockTimestamp = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsProcessed = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SyncedBlocks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SyncedEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EventType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ContractAddress = table.Column<string>(type: "character varying(42)", maxLength: 42, nullable: false),
                    BlockNumber = table.Column<long>(type: "bigint", nullable: false),
                    TransactionHash = table.Column<string>(type: "text", nullable: false),
                    EventData = table.Column<string>(type: "jsonb", nullable: false),
                    IsPublished = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SyncedEvents", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SyncedBlocks_BlockNumber",
                table: "SyncedBlocks",
                column: "BlockNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SyncedEvents_TransactionHash",
                table: "SyncedEvents",
                column: "TransactionHash");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SyncedBlocks");

            migrationBuilder.DropTable(
                name: "SyncedEvents");
        }
    }
}

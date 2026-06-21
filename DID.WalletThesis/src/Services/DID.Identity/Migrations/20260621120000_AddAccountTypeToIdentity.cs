using DID.Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DID.Identity.Migrations;

[DbContext(typeof(IdentityDbContext))]
[Migration("20260621120000_AddAccountTypeToIdentity")]
public partial class AddAccountTypeToIdentity : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "AccountType",
            table: "dids",
            type: "character varying(32)",
            maxLength: 32,
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "AccountType",
            table: "dids");
    }
}

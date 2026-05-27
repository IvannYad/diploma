using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NewsConsole.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddIntelectualProcessingProcesses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "IntellectualProcessingProcesses",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Type = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    AssignedServer = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ResultStatus = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ResultMessage = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IntellectualProcessingProcesses", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "IntellectualProcessingProcesses");
        }
    }
}

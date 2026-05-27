using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NewsConsole.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMongoDbServerUrlToProcessingProcess : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MongoDbServerUrl",
                table: "IntellectualProcessingProcesses",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MongoDbServerUrl",
                table: "IntellectualProcessingProcesses");
        }
    }
}

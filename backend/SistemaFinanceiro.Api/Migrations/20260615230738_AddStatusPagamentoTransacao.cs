using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SistemaFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddStatusPagamentoTransacao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "is_paga",
                table: "transacoes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.Sql("""
                UPDATE transacoes
                SET is_paga = TRUE
                WHERE data_ocorrencia <= CURRENT_DATE;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "is_paga",
                table: "transacoes");
        }
    }
}

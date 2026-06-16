using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SistemaFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDivisaoDespesas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "is_dividida",
                table: "transacoes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "percentual_divisao",
                table: "transacoes",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "valor_total_original",
                table: "transacoes",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "percentual_padrao_divisao",
                table: "configuracoes_usuario",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 50m);

            migrationBuilder.AddColumn<bool>(
                name: "is_dividida",
                table: "compras_parceladas",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "percentual_divisao",
                table: "compras_parceladas",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "valor_total_original",
                table: "compras_parceladas",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "is_dividida",
                table: "transacoes");

            migrationBuilder.DropColumn(
                name: "percentual_divisao",
                table: "transacoes");

            migrationBuilder.DropColumn(
                name: "valor_total_original",
                table: "transacoes");

            migrationBuilder.DropColumn(
                name: "percentual_padrao_divisao",
                table: "configuracoes_usuario");

            migrationBuilder.DropColumn(
                name: "is_dividida",
                table: "compras_parceladas");

            migrationBuilder.DropColumn(
                name: "percentual_divisao",
                table: "compras_parceladas");

            migrationBuilder.DropColumn(
                name: "valor_total_original",
                table: "compras_parceladas");
        }
    }
}

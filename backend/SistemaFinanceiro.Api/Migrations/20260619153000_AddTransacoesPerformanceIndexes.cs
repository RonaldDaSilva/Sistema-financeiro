using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SistemaFinanceiro.Api.Migrations;

public partial class AddTransacoesPerformanceIndexes : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateIndex(
            name: "IX_transacoes_id_usuario_data_ocorrencia",
            table: "transacoes",
            columns: new[] { "id_usuario", "data_ocorrencia" });

        migrationBuilder.CreateIndex(
            name: "IX_transacoes_id_usuario_is_paga_data_ocorrencia",
            table: "transacoes",
            columns: new[] { "id_usuario", "is_paga", "data_ocorrencia" });

        migrationBuilder.CreateIndex(
            name: "IX_transacoes_id_usuario_tipo_data_ocorrencia",
            table: "transacoes",
            columns: new[] { "id_usuario", "tipo", "data_ocorrencia" });

        migrationBuilder.CreateIndex(
            name: "IX_transacoes_id_usuario_id_categoria_data_ocorrencia",
            table: "transacoes",
            columns: new[] { "id_usuario", "id_categoria", "data_ocorrencia" });

        migrationBuilder.CreateIndex(
            name: "IX_transacoes_id_usuario_id_cartao_credito_data_ocorrencia",
            table: "transacoes",
            columns: new[] { "id_usuario", "id_cartao_credito", "data_ocorrencia" });

        migrationBuilder.CreateIndex(
            name: "IX_transacoes_id_usuario_id_compra_parcelada_numero_parcela_quitada",
            table: "transacoes",
            columns: new[] { "id_usuario", "id_compra_parcelada", "numero_parcela_quitada" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_transacoes_id_usuario_data_ocorrencia",
            table: "transacoes");

        migrationBuilder.DropIndex(
            name: "IX_transacoes_id_usuario_is_paga_data_ocorrencia",
            table: "transacoes");

        migrationBuilder.DropIndex(
            name: "IX_transacoes_id_usuario_tipo_data_ocorrencia",
            table: "transacoes");

        migrationBuilder.DropIndex(
            name: "IX_transacoes_id_usuario_id_categoria_data_ocorrencia",
            table: "transacoes");

        migrationBuilder.DropIndex(
            name: "IX_transacoes_id_usuario_id_cartao_credito_data_ocorrencia",
            table: "transacoes");

        migrationBuilder.DropIndex(
            name: "IX_transacoes_id_usuario_id_compra_parcelada_numero_parcela_quitada",
            table: "transacoes");
    }
}

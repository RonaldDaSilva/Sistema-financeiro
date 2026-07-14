using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SistemaFinanceiro.Api.Migrations
{
    public partial class AddAjusteTransferenciaArquivamento : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "is_arquivada",
                table: "contas_bancarias",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "is_arquivado",
                table: "cartoes_credito",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "origem_transacao",
                table: "transacoes",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "Lancamento");

            migrationBuilder.AddColumn<Guid>(
                name: "id_transferencia",
                table: "transacoes",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "saldo_anterior_ajuste",
                table: "transacoes",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "saldo_informado_ajuste",
                table: "transacoes",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "observacao",
                table: "transacoes",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_transacoes_id_usuario_origem_transacao_data_ocorrencia",
                table: "transacoes",
                columns: new[] { "id_usuario", "origem_transacao", "data_ocorrencia" });

            migrationBuilder.CreateIndex(
                name: "IX_transacoes_id_usuario_id_transferencia",
                table: "transacoes",
                columns: new[] { "id_usuario", "id_transferencia" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_transacoes_id_usuario_origem_transacao_data_ocorrencia",
                table: "transacoes");

            migrationBuilder.DropIndex(
                name: "IX_transacoes_id_usuario_id_transferencia",
                table: "transacoes");

            migrationBuilder.DropColumn(
                name: "is_arquivada",
                table: "contas_bancarias");

            migrationBuilder.DropColumn(
                name: "is_arquivado",
                table: "cartoes_credito");

            migrationBuilder.DropColumn(
                name: "origem_transacao",
                table: "transacoes");

            migrationBuilder.DropColumn(
                name: "id_transferencia",
                table: "transacoes");

            migrationBuilder.DropColumn(
                name: "saldo_anterior_ajuste",
                table: "transacoes");

            migrationBuilder.DropColumn(
                name: "saldo_informado_ajuste",
                table: "transacoes");

            migrationBuilder.DropColumn(
                name: "observacao",
                table: "transacoes");
        }
    }
}

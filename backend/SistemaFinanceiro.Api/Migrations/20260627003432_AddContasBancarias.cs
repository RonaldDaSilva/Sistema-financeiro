using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SistemaFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddContasBancarias : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "id_conta_bancaria",
                table: "transacoes",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "contas_bancarias",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    id_usuario = table.Column<Guid>(type: "uuid", nullable: false),
                    nome_customizado = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    codigo_banco = table.Column<string>(type: "character(3)", fixedLength: true, maxLength: 3, nullable: false),
                    saldo_inicial = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    data_criacao = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_contas_bancarias", x => x.id);
                    table.ForeignKey(
                        name: "FK_contas_bancarias_usuarios_id_usuario",
                        column: x => x.id_usuario,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_transacoes_id_conta_bancaria",
                table: "transacoes",
                column: "id_conta_bancaria");

            migrationBuilder.CreateIndex(
                name: "IX_transacoes_id_usuario_id_conta_bancaria_data_ocorrencia",
                table: "transacoes",
                columns: new[] { "id_usuario", "id_conta_bancaria", "data_ocorrencia" });

            migrationBuilder.CreateIndex(
                name: "IX_contas_bancarias_id_usuario",
                table: "contas_bancarias",
                column: "id_usuario");

            migrationBuilder.AddForeignKey(
                name: "FK_transacoes_contas_bancarias_id_conta_bancaria",
                table: "transacoes",
                column: "id_conta_bancaria",
                principalTable: "contas_bancarias",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_transacoes_contas_bancarias_id_conta_bancaria",
                table: "transacoes");

            migrationBuilder.DropTable(
                name: "contas_bancarias");

            migrationBuilder.DropIndex(
                name: "IX_transacoes_id_conta_bancaria",
                table: "transacoes");

            migrationBuilder.DropIndex(
                name: "IX_transacoes_id_usuario_id_conta_bancaria_data_ocorrencia",
                table: "transacoes");

            migrationBuilder.DropColumn(
                name: "id_conta_bancaria",
                table: "transacoes");
        }
    }
}

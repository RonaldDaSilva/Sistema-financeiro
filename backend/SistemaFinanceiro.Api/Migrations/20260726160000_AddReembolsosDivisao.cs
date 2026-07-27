using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SistemaFinanceiro.Api.Migrations
{
    public partial class AddReembolsosDivisao : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "id_reembolso_divisao",
                table: "transacoes",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "reembolsos_divisao",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    id_usuario = table.Column<Guid>(type: "uuid", nullable: false),
                    id_divisao_transacao = table.Column<Guid>(type: "uuid", nullable: false),
                    id_participante = table.Column<Guid>(type: "uuid", nullable: true),
                    id_usuario_participante = table.Column<Guid>(type: "uuid", nullable: true),
                    participante_externo_nome = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    valor_devido = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    valor_recebido = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    criado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    atualizado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reembolsos_divisao", x => x.id);
                    table.ForeignKey(
                        name: "FK_reembolsos_divisao_divisoes_transacoes_id_divisao_trans~",
                        column: x => x.id_divisao_transacao,
                        principalTable: "divisoes_transacoes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_reembolsos_divisao_divisoes_transacoes_participantes_id~",
                        column: x => x.id_participante,
                        principalTable: "divisoes_transacoes_participantes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_reembolsos_divisao_usuarios_id_usuario_participante",
                        column: x => x.id_usuario_participante,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_transacoes_id_reembolso_divisao",
                table: "transacoes",
                column: "id_reembolso_divisao");

            migrationBuilder.CreateIndex(
                name: "IX_reembolsos_divisao_id_divisao_transacao",
                table: "reembolsos_divisao",
                column: "id_divisao_transacao");

            migrationBuilder.CreateIndex(
                name: "IX_reembolsos_divisao_id_participante",
                table: "reembolsos_divisao",
                column: "id_participante");

            migrationBuilder.CreateIndex(
                name: "IX_reembolsos_divisao_id_usuario",
                table: "reembolsos_divisao",
                column: "id_usuario");

            migrationBuilder.CreateIndex(
                name: "IX_reembolsos_divisao_id_usuario_participante",
                table: "reembolsos_divisao",
                column: "id_usuario_participante");

            migrationBuilder.AddForeignKey(
                name: "FK_transacoes_reembolsos_divisao_id_reembolso_divisao",
                table: "transacoes",
                column: "id_reembolso_divisao",
                principalTable: "reembolsos_divisao",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_transacoes_reembolsos_divisao_id_reembolso_divisao",
                table: "transacoes");

            migrationBuilder.DropTable(
                name: "reembolsos_divisao");

            migrationBuilder.DropIndex(
                name: "IX_transacoes_id_reembolso_divisao",
                table: "transacoes");

            migrationBuilder.DropColumn(
                name: "id_reembolso_divisao",
                table: "transacoes");
        }
    }
}

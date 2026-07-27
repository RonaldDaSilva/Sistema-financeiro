using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SistemaFinanceiro.Api.Migrations
{
    public partial class AddVersionamentoDivisoes : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "divisoes_transacoes_versoes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    id_usuario = table.Column<Guid>(type: "uuid", nullable: false),
                    id_divisao_transacao = table.Column<Guid>(type: "uuid", nullable: false),
                    versao = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    escopo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    id_usuario_solicitante = table.Column<Guid>(type: "uuid", nullable: false),
                    id_usuario_respondente = table.Column<Guid>(type: "uuid", nullable: true),
                    valor_total_anterior = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    valor_total_proposto = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    percentual_criador_anterior = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    percentual_criador_proposto = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    valor_criador_anterior = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    valor_criador_proposto = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    percentual_participante_anterior = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    percentual_participante_proposto = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    valor_participante_anterior = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    valor_participante_proposto = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    vencimento_anterior = table.Column<DateOnly>(type: "date", nullable: true),
                    vencimento_proposto = table.Column<DateOnly>(type: "date", nullable: true),
                    quantidade_parcelas_anterior = table.Column<int>(type: "integer", nullable: true),
                    quantidade_parcelas_proposta = table.Column<int>(type: "integer", nullable: true),
                    recorrencia_anterior = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    recorrencia_proposta = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    frequencia_anterior = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    frequencia_proposta = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    responsabilidade_anterior = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    responsabilidade_proposta = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    criado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    respondido_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    motivo_resposta = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_divisoes_transacoes_versoes", x => x.id);
                    table.ForeignKey(
                        name: "FK_divisoes_transacoes_versoes_divisoes_transacoes_id_divis~",
                        column: x => x.id_divisao_transacao,
                        principalTable: "divisoes_transacoes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_divisoes_transacoes_versoes_id_divisao_transacao",
                table: "divisoes_transacoes_versoes",
                column: "id_divisao_transacao");

            migrationBuilder.CreateIndex(
                name: "IX_divisoes_transacoes_versoes_id_divisao_transacao_versao",
                table: "divisoes_transacoes_versoes",
                columns: new[] { "id_divisao_transacao", "versao" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_divisoes_transacoes_versoes_id_usuario",
                table: "divisoes_transacoes_versoes",
                column: "id_usuario");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "divisoes_transacoes_versoes");
        }
    }
}

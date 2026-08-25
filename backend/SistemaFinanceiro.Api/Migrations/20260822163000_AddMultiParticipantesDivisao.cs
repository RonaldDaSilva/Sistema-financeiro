using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SistemaFinanceiro.Api.Data;

#nullable disable

namespace SistemaFinanceiro.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260822163000_AddMultiParticipantesDivisao")]
public sealed class AddMultiParticipantesDivisao : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "modo_definicao",
            table: "divisoes_transacoes_participantes",
            type: "character varying(20)",
            maxLength: 20,
            nullable: false,
            defaultValue: "Percentual");

        migrationBuilder.AddColumn<Guid>(
            name: "id_participante_divisao",
            table: "notificacoes",
            type: "uuid",
            nullable: true);

        migrationBuilder.CreateTable(
            name: "divisoes_transacoes_versoes_participantes",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                id_usuario = table.Column<Guid>(type: "uuid", nullable: false),
                id_divisao_transacao_versao = table.Column<Guid>(type: "uuid", nullable: false),
                id_divisao_transacao_participante = table.Column<Guid>(type: "uuid", nullable: false),
                percentual_anterior = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                percentual_proposto = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                valor_anterior = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                valor_proposto = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                respondido_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                motivo_resposta = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_divisoes_transacoes_versoes_participantes", x => x.id);
                table.ForeignKey(
                    name: "FK_divisoes_versoes_participantes_participantes",
                    column: x => x.id_divisao_transacao_participante,
                    principalTable: "divisoes_transacoes_participantes",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "FK_divisoes_versoes_participantes_versoes",
                    column: x => x.id_divisao_transacao_versao,
                    principalTable: "divisoes_transacoes_versoes",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_divisoes_versoes_participantes_id_usuario",
            table: "divisoes_transacoes_versoes_participantes",
            column: "id_usuario");
        migrationBuilder.CreateIndex(
            name: "IX_divisoes_versoes_participantes_id_participante",
            table: "divisoes_transacoes_versoes_participantes",
            column: "id_divisao_transacao_participante");
        migrationBuilder.CreateIndex(
            name: "IX_divisoes_versoes_participantes_versao_participante",
            table: "divisoes_transacoes_versoes_participantes",
            columns: new[] { "id_divisao_transacao_versao", "id_divisao_transacao_participante" },
            unique: true);
        migrationBuilder.CreateIndex(
            name: "IX_notificacoes_divisao_participante",
            table: "notificacoes",
            columns: new[] { "id_usuario", "entidade", "entidade_id", "tipo_notificacao", "versao", "id_participante_divisao" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "divisoes_transacoes_versoes_participantes");
        migrationBuilder.DropIndex(name: "IX_notificacoes_divisao_participante", table: "notificacoes");
        migrationBuilder.DropColumn(name: "modo_definicao", table: "divisoes_transacoes_participantes");
        migrationBuilder.DropColumn(name: "id_participante_divisao", table: "notificacoes");
    }
}

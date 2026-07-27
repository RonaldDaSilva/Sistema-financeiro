using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SistemaFinanceiro.Api.Migrations
{
    public partial class AddConvitesDivisao : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "quantidade_reenvios",
                table: "divisoes_transacoes",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "encerrado_em",
                table: "divisoes_transacoes",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "expira_em",
                table: "divisoes_transacoes_participantes",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "versao_convite",
                table: "divisoes_transacoes_participantes",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<string>(
                name: "motivo_resposta",
                table: "divisoes_transacoes_participantes",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "entidade",
                table: "notificacoes",
                type: "character varying(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "entidade_id",
                table: "notificacoes",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "rota",
                table: "notificacoes",
                type: "character varying(240)",
                maxLength: 240,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "acao_pendente",
                table: "notificacoes",
                type: "character varying(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "versao",
                table: "notificacoes",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "contatos_divisao",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    id_usuario = table.Column<Guid>(type: "uuid", nullable: false),
                    id_usuario_contato = table.Column<Guid>(type: "uuid", nullable: false),
                    apelido = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    ultimo_uso_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    criado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    ativo = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_contatos_divisao", x => x.id);
                    table.ForeignKey(
                        name: "FK_contatos_divisao_usuarios_id_usuario",
                        column: x => x.id_usuario,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_contatos_divisao_usuarios_id_usuario_contato",
                        column: x => x.id_usuario_contato,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_notificacoes_id_usuario_entidade_entidade_id_tipo_notificacao_versao",
                table: "notificacoes",
                columns: new[] { "id_usuario", "entidade", "entidade_id", "tipo_notificacao", "versao" });

            migrationBuilder.CreateIndex(
                name: "IX_contatos_divisao_id_usuario",
                table: "contatos_divisao",
                column: "id_usuario");

            migrationBuilder.CreateIndex(
                name: "IX_contatos_divisao_id_usuario_contato",
                table: "contatos_divisao",
                column: "id_usuario_contato");

            migrationBuilder.CreateIndex(
                name: "IX_contatos_divisao_id_usuario_id_usuario_contato",
                table: "contatos_divisao",
                columns: new[] { "id_usuario", "id_usuario_contato" },
                unique: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "contatos_divisao");

            migrationBuilder.DropIndex(
                name: "IX_notificacoes_id_usuario_entidade_entidade_id_tipo_notificacao_versao",
                table: "notificacoes");

            migrationBuilder.DropColumn(name: "quantidade_reenvios", table: "divisoes_transacoes");
            migrationBuilder.DropColumn(name: "encerrado_em", table: "divisoes_transacoes");
            migrationBuilder.DropColumn(name: "expira_em", table: "divisoes_transacoes_participantes");
            migrationBuilder.DropColumn(name: "versao_convite", table: "divisoes_transacoes_participantes");
            migrationBuilder.DropColumn(name: "motivo_resposta", table: "divisoes_transacoes_participantes");
            migrationBuilder.DropColumn(name: "entidade", table: "notificacoes");
            migrationBuilder.DropColumn(name: "entidade_id", table: "notificacoes");
            migrationBuilder.DropColumn(name: "rota", table: "notificacoes");
            migrationBuilder.DropColumn(name: "acao_pendente", table: "notificacoes");
            migrationBuilder.DropColumn(name: "versao", table: "notificacoes");
        }
    }
}

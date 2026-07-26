using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SistemaFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDivisoesTransacoes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "divisoes_transacoes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    id_usuario = table.Column<Guid>(type: "uuid", nullable: false),
                    id_usuario_criador = table.Column<Guid>(type: "uuid", nullable: false),
                    id_transacao_origem = table.Column<Guid>(type: "uuid", nullable: true),
                    id_compra_parcelada = table.Column<Guid>(type: "uuid", nullable: true),
                    id_serie = table.Column<Guid>(type: "uuid", nullable: true),
                    valor_total = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    versao_atual = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    criado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    atualizado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_divisoes_transacoes", x => x.id);
                    table.ForeignKey(
                        name: "FK_divisoes_transacoes_compras_parceladas_id_compra_parcelada",
                        column: x => x.id_compra_parcelada,
                        principalTable: "compras_parceladas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_divisoes_transacoes_transacoes_id_transacao_origem",
                        column: x => x.id_transacao_origem,
                        principalTable: "transacoes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_divisoes_transacoes_usuarios_id_usuario_criador",
                        column: x => x.id_usuario_criador,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "divisoes_transacoes_participantes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    id_usuario = table.Column<Guid>(type: "uuid", nullable: false),
                    id_divisao_transacao = table.Column<Guid>(type: "uuid", nullable: false),
                    id_usuario_participante = table.Column<Guid>(type: "uuid", nullable: true),
                    tipo_participante = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    percentual = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    valor = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    id_transacao_gerada = table.Column<Guid>(type: "uuid", nullable: true),
                    respondido_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    versao_aceita = table.Column<int>(type: "integer", nullable: true),
                    ativo = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_divisoes_transacoes_participantes", x => x.id);
                    table.ForeignKey(
                        name: "FK_divisoes_transacoes_participantes_divisoes_transacoes_id~",
                        column: x => x.id_divisao_transacao,
                        principalTable: "divisoes_transacoes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_divisoes_transacoes_participantes_transacoes_id_transacao~",
                        column: x => x.id_transacao_gerada,
                        principalTable: "transacoes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_divisoes_transacoes_participantes_usuarios_id_usuario_p~",
                        column: x => x.id_usuario_participante,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_divisoes_transacoes_id_compra_parcelada",
                table: "divisoes_transacoes",
                column: "id_compra_parcelada");

            migrationBuilder.CreateIndex(
                name: "IX_divisoes_transacoes_id_serie",
                table: "divisoes_transacoes",
                column: "id_serie");

            migrationBuilder.CreateIndex(
                name: "IX_divisoes_transacoes_id_transacao_origem",
                table: "divisoes_transacoes",
                column: "id_transacao_origem");

            migrationBuilder.CreateIndex(
                name: "IX_divisoes_transacoes_id_usuario",
                table: "divisoes_transacoes",
                column: "id_usuario");

            migrationBuilder.CreateIndex(
                name: "IX_divisoes_transacoes_id_usuario_criador",
                table: "divisoes_transacoes",
                column: "id_usuario_criador");

            migrationBuilder.CreateIndex(
                name: "IX_divisoes_transacoes_participantes_id_divisao_transacao",
                table: "divisoes_transacoes_participantes",
                column: "id_divisao_transacao");

            migrationBuilder.CreateIndex(
                name: "IX_divisoes_transacoes_participantes_id_transacao_gerada",
                table: "divisoes_transacoes_participantes",
                column: "id_transacao_gerada");

            migrationBuilder.CreateIndex(
                name: "IX_divisoes_transacoes_participantes_id_usuario",
                table: "divisoes_transacoes_participantes",
                column: "id_usuario");

            migrationBuilder.CreateIndex(
                name: "IX_divisoes_transacoes_participantes_id_usuario_participan~",
                table: "divisoes_transacoes_participantes",
                column: "id_usuario_participante");

            migrationBuilder.CreateIndex(
                name: "IX_divisoes_transacoes_participantes_id_divisao_transacao~",
                table: "divisoes_transacoes_participantes",
                columns: new[] { "id_divisao_transacao", "tipo_participante" },
                unique: true,
                filter: "tipo_participante = 'Criador' AND ativo = true");

            migrationBuilder.CreateIndex(
                name: "IX_divisoes_transacoes_participantes_id_divisao_transaca~1",
                table: "divisoes_transacoes_participantes",
                columns: new[] { "id_divisao_transacao", "id_usuario_participante" },
                unique: true,
                filter: "id_usuario_participante IS NOT NULL AND ativo = true");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "divisoes_transacoes_participantes");
            migrationBuilder.DropTable(name: "divisoes_transacoes");
        }
    }
}

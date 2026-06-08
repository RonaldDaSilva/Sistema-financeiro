using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SistemaFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "usuarios",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    nome = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: false),
                    senha_hash = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    telefone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    criado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_usuarios", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "cartoes_credito",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    id_usuario = table.Column<Guid>(type: "uuid", nullable: false),
                    apelido_cartao = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    banco = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    dia_vencimento = table.Column<int>(type: "integer", nullable: false),
                    melhor_dia_compra = table.Column<int>(type: "integer", nullable: false),
                    limite_total = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cartoes_credito", x => x.id);
                    table.ForeignKey(
                        name: "FK_cartoes_credito_usuarios_id_usuario",
                        column: x => x.id_usuario,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "categorias",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    id_usuario = table.Column<Guid>(type: "uuid", nullable: true),
                    nome = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    cor_hexa = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_categorias", x => x.id);
                    table.ForeignKey(
                        name: "FK_categorias_usuarios_id_usuario",
                        column: x => x.id_usuario,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "refresh_tokens",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    id_usuario = table.Column<Guid>(type: "uuid", nullable: false),
                    token_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    expira_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    criado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    revogado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_refresh_tokens", x => x.id);
                    table.ForeignKey(
                        name: "FK_refresh_tokens_usuarios_id_usuario",
                        column: x => x.id_usuario,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "compras_parceladas",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    id_usuario = table.Column<Guid>(type: "uuid", nullable: false),
                    id_cartao_credito = table.Column<Guid>(type: "uuid", nullable: false),
                    id_categoria = table.Column<Guid>(type: "uuid", nullable: false),
                    descricao = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    quantidade_parcelas = table.Column<int>(type: "integer", nullable: false),
                    valor_total = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    data_compra = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_compras_parceladas", x => x.id);
                    table.ForeignKey(
                        name: "FK_compras_parceladas_cartoes_credito_id_cartao_credito",
                        column: x => x.id_cartao_credito,
                        principalTable: "cartoes_credito",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_compras_parceladas_categorias_id_categoria",
                        column: x => x.id_categoria,
                        principalTable: "categorias",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_compras_parceladas_usuarios_id_usuario",
                        column: x => x.id_usuario,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "transacoes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    codigo_exibicao = table.Column<int>(type: "integer", nullable: false),
                    id_usuario = table.Column<Guid>(type: "uuid", nullable: false),
                    tipo = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    descricao = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    valor = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    data_ocorrencia = table.Column<DateOnly>(type: "date", nullable: false),
                    id_categoria = table.Column<Guid>(type: "uuid", nullable: false),
                    forma_pagamento = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    id_cartao_credito = table.Column<Guid>(type: "uuid", nullable: true),
                    is_fixa = table.Column<bool>(type: "boolean", nullable: false),
                    id_compra_parcelada = table.Column<Guid>(type: "uuid", nullable: true),
                    numero_parcela_quitada = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_transacoes", x => x.id);
                    table.ForeignKey(
                        name: "FK_transacoes_cartoes_credito_id_cartao_credito",
                        column: x => x.id_cartao_credito,
                        principalTable: "cartoes_credito",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_transacoes_categorias_id_categoria",
                        column: x => x.id_categoria,
                        principalTable: "categorias",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_transacoes_compras_parceladas_id_compra_parcelada",
                        column: x => x.id_compra_parcelada,
                        principalTable: "compras_parceladas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_transacoes_usuarios_id_usuario",
                        column: x => x.id_usuario,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_cartoes_credito_id_usuario_apelido_cartao",
                table: "cartoes_credito",
                columns: new[] { "id_usuario", "apelido_cartao" });

            migrationBuilder.CreateIndex(
                name: "IX_categorias_id_usuario_nome",
                table: "categorias",
                columns: new[] { "id_usuario", "nome" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_compras_parceladas_id_cartao_credito",
                table: "compras_parceladas",
                column: "id_cartao_credito");

            migrationBuilder.CreateIndex(
                name: "IX_compras_parceladas_id_categoria",
                table: "compras_parceladas",
                column: "id_categoria");

            migrationBuilder.CreateIndex(
                name: "IX_compras_parceladas_id_usuario",
                table: "compras_parceladas",
                column: "id_usuario");

            migrationBuilder.CreateIndex(
                name: "IX_refresh_tokens_id_usuario",
                table: "refresh_tokens",
                column: "id_usuario");

            migrationBuilder.CreateIndex(
                name: "IX_refresh_tokens_token_hash",
                table: "refresh_tokens",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_transacoes_id_cartao_credito",
                table: "transacoes",
                column: "id_cartao_credito");

            migrationBuilder.CreateIndex(
                name: "IX_transacoes_id_categoria",
                table: "transacoes",
                column: "id_categoria");

            migrationBuilder.CreateIndex(
                name: "IX_transacoes_id_compra_parcelada",
                table: "transacoes",
                column: "id_compra_parcelada");

            migrationBuilder.CreateIndex(
                name: "IX_transacoes_id_usuario_codigo_exibicao",
                table: "transacoes",
                columns: new[] { "id_usuario", "codigo_exibicao" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_usuarios_email",
                table: "usuarios",
                column: "email",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "refresh_tokens");

            migrationBuilder.DropTable(
                name: "transacoes");

            migrationBuilder.DropTable(
                name: "compras_parceladas");

            migrationBuilder.DropTable(
                name: "cartoes_credito");

            migrationBuilder.DropTable(
                name: "categorias");

            migrationBuilder.DropTable(
                name: "usuarios");
        }
    }
}

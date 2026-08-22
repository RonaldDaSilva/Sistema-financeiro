using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SistemaFinanceiro.Api.Data;

#nullable disable

namespace SistemaFinanceiro.Api.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260820120000_AddEmprestimosValoresReceber")]
    public partial class AddEmprestimosValoresReceber : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "contatos_emprestimos",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    id_usuario = table.Column<Guid>(type: "uuid", nullable: false),
                    nome = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    observacao = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ativo = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    criado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    atualizado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_contatos_emprestimos", x => x.id);
                    table.ForeignKey(
                        name: "FK_contatos_emprestimos_usuarios_id_usuario",
                        column: x => x.id_usuario,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "emprestimos",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    id_usuario = table.Column<Guid>(type: "uuid", nullable: false),
                    id_contato = table.Column<Guid>(type: "uuid", nullable: false),
                    descricao = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    valor_total = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    data = table.Column<DateOnly>(type: "date", nullable: false),
                    origem_financeira = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    id_cartao_credito = table.Column<Guid>(type: "uuid", nullable: true),
                    id_conta_bancaria = table.Column<Guid>(type: "uuid", nullable: true),
                    quantidade_parcelas = table.Column<int>(type: "integer", nullable: false),
                    observacao = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    criado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    atualizado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_emprestimos", x => x.id);
                    table.ForeignKey(
                        name: "FK_emprestimos_cartoes_credito_id_cartao_credito",
                        column: x => x.id_cartao_credito,
                        principalTable: "cartoes_credito",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_emprestimos_contas_bancarias_id_conta_bancaria",
                        column: x => x.id_conta_bancaria,
                        principalTable: "contas_bancarias",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_emprestimos_contatos_emprestimos_id_contato",
                        column: x => x.id_contato,
                        principalTable: "contatos_emprestimos",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_emprestimos_usuarios_id_usuario",
                        column: x => x.id_usuario,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "pagamentos_emprestimos",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    id_usuario = table.Column<Guid>(type: "uuid", nullable: false),
                    id_emprestimo = table.Column<Guid>(type: "uuid", nullable: false),
                    data = table.Column<DateOnly>(type: "date", nullable: false),
                    id_conta_bancaria = table.Column<Guid>(type: "uuid", nullable: true),
                    valor_total = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    observacao = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    criado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pagamentos_emprestimos", x => x.id);
                    table.ForeignKey(
                        name: "FK_pagamentos_emprestimos_contas_bancarias_id_conta_bancaria",
                        column: x => x.id_conta_bancaria,
                        principalTable: "contas_bancarias",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_pagamentos_emprestimos_emprestimos_id_emprestimo",
                        column: x => x.id_emprestimo,
                        principalTable: "emprestimos",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_pagamentos_emprestimos_usuarios_id_usuario",
                        column: x => x.id_usuario,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "parcelas_emprestimos",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    id_usuario = table.Column<Guid>(type: "uuid", nullable: false),
                    id_emprestimo = table.Column<Guid>(type: "uuid", nullable: false),
                    id_pagamento_emprestimo = table.Column<Guid>(type: "uuid", nullable: true),
                    numero_parcela = table.Column<int>(type: "integer", nullable: false),
                    data_vencimento = table.Column<DateOnly>(type: "date", nullable: false),
                    valor = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    data_pagamento = table.Column<DateOnly>(type: "date", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_parcelas_emprestimos", x => x.id);
                    table.ForeignKey(
                        name: "FK_parcelas_emprestimos_emprestimos_id_emprestimo",
                        column: x => x.id_emprestimo,
                        principalTable: "emprestimos",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_parcelas_emprestimos_pagamentos_emprestimos_id_pagamento",
                        column: x => x.id_pagamento_emprestimo,
                        principalTable: "pagamentos_emprestimos",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_parcelas_emprestimos_usuarios_id_usuario",
                        column: x => x.id_usuario,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex("IX_contatos_emprestimos_id_usuario", "contatos_emprestimos", "id_usuario");
            migrationBuilder.CreateIndex("IX_emprestimos_id_cartao_credito", "emprestimos", "id_cartao_credito");
            migrationBuilder.CreateIndex("IX_emprestimos_id_conta_bancaria", "emprestimos", "id_conta_bancaria");
            migrationBuilder.CreateIndex("IX_emprestimos_id_contato", "emprestimos", "id_contato");
            migrationBuilder.CreateIndex("IX_emprestimos_id_usuario", "emprestimos", "id_usuario");
            migrationBuilder.CreateIndex("IX_emprestimos_status", "emprestimos", "status");
            migrationBuilder.CreateIndex("IX_pagamentos_emprestimos_id_conta_bancaria", "pagamentos_emprestimos", "id_conta_bancaria");
            migrationBuilder.CreateIndex("IX_pagamentos_emprestimos_id_emprestimo", "pagamentos_emprestimos", "id_emprestimo");
            migrationBuilder.CreateIndex("IX_pagamentos_emprestimos_id_usuario", "pagamentos_emprestimos", "id_usuario");
            migrationBuilder.CreateIndex("IX_parcelas_emprestimos_id_emprestimo", "parcelas_emprestimos", "id_emprestimo");
            migrationBuilder.CreateIndex("IX_parcelas_emprestimos_id_pagamento_emprestimo", "parcelas_emprestimos", "id_pagamento_emprestimo");
            migrationBuilder.CreateIndex("IX_parcelas_emprestimos_id_usuario", "parcelas_emprestimos", "id_usuario");
            migrationBuilder.CreateIndex("IX_parcelas_emprestimos_status", "parcelas_emprestimos", "status");
            migrationBuilder.CreateIndex(
                name: "IX_parcelas_emprestimos_id_emprestimo_numero_parcela",
                table: "parcelas_emprestimos",
                columns: new[] { "id_emprestimo", "numero_parcela" },
                unique: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "parcelas_emprestimos");
            migrationBuilder.DropTable(name: "pagamentos_emprestimos");
            migrationBuilder.DropTable(name: "emprestimos");
            migrationBuilder.DropTable(name: "contatos_emprestimos");
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SistemaFinanceiro.Api.Migrations
{
    public partial class AddFechamentoMensalSaldo : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "fechamentos_mensais_saldo",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    id_usuario = table.Column<Guid>(type: "uuid", nullable: false),
                    ano = table.Column<int>(type: "integer", nullable: false),
                    mes = table.Column<int>(type: "integer", nullable: false),
                    data_fechamento = table.Column<DateOnly>(type: "date", nullable: false),
                    saldo_global = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    data_criacao = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    data_atualizacao = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    versao_regra = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    observacao = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_fechamentos_mensais_saldo", x => x.id);
                    table.ForeignKey(
                        name: "FK_fechamentos_mensais_saldo_usuarios_id_usuario",
                        column: x => x.id_usuario,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "fechamentos_mensais_conta",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    id_fechamento_mensal_saldo = table.Column<Guid>(type: "uuid", nullable: false),
                    id_conta_bancaria = table.Column<Guid>(type: "uuid", nullable: false),
                    saldo = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_fechamentos_mensais_conta", x => x.id);
                    table.ForeignKey(
                        name: "FK_fechamentos_mensais_conta_contas_bancarias_id_conta_ba~",
                        column: x => x.id_conta_bancaria,
                        principalTable: "contas_bancarias",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_fechamentos_mensais_conta_fechamentos_mensais_saldo_i~",
                        column: x => x.id_fechamento_mensal_saldo,
                        principalTable: "fechamentos_mensais_saldo",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_fechamentos_mensais_conta_id_conta_bancaria",
                table: "fechamentos_mensais_conta",
                column: "id_conta_bancaria");

            migrationBuilder.CreateIndex(
                name: "IX_fechamentos_mensais_conta_id_fechamento_mensal_saldo~",
                table: "fechamentos_mensais_conta",
                columns: new[] { "id_fechamento_mensal_saldo", "id_conta_bancaria" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_fechamentos_mensais_saldo_id_usuario_ano_mes",
                table: "fechamentos_mensais_saldo",
                columns: new[] { "id_usuario", "ano", "mes" },
                unique: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "fechamentos_mensais_conta");
            migrationBuilder.DropTable(name: "fechamentos_mensais_saldo");
        }
    }
}

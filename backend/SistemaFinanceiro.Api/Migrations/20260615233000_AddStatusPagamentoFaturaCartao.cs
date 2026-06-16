using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SistemaFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddStatusPagamentoFaturaCartao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "faturas_cartao_pagamentos",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    id_usuario = table.Column<Guid>(type: "uuid", nullable: false),
                    id_cartao_credito = table.Column<Guid>(type: "uuid", nullable: false),
                    data_vencimento = table.Column<DateOnly>(type: "date", nullable: false),
                    is_paga = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_faturas_cartao_pagamentos", x => x.id);
                    table.ForeignKey(
                        name: "FK_faturas_cartao_pagamentos_cartoes_credito_id_cartao_cre~",
                        column: x => x.id_cartao_credito,
                        principalTable: "cartoes_credito",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_faturas_cartao_pagamentos_usuarios_id_usuario",
                        column: x => x.id_usuario,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_faturas_cartao_pagamentos_id_cartao_credito",
                table: "faturas_cartao_pagamentos",
                column: "id_cartao_credito");

            migrationBuilder.CreateIndex(
                name: "IX_faturas_cartao_pagamentos_id_usuario_id_cartao_credito~",
                table: "faturas_cartao_pagamentos",
                columns: new[] { "id_usuario", "id_cartao_credito", "data_vencimento" },
                unique: true);

            migrationBuilder.Sql("""
                UPDATE transacoes
                SET is_paga = FALSE
                WHERE tipo = 'Receita';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "faturas_cartao_pagamentos");
        }
    }
}

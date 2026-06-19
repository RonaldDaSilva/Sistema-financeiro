using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SistemaFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTransacaoFixaPagamentos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "transacoes_fixas_pagamentos",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    id_usuario = table.Column<Guid>(type: "uuid", nullable: false),
                    id_transacao_fixa = table.Column<Guid>(type: "uuid", nullable: false),
                    data_ocorrencia = table.Column<DateOnly>(type: "date", nullable: false),
                    is_paga = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_transacoes_fixas_pagamentos", x => x.id);
                    table.ForeignKey(
                        name: "FK_transacoes_fixas_pagamentos_transacoes_id_transacao_fixa",
                        column: x => x.id_transacao_fixa,
                        principalTable: "transacoes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_transacoes_fixas_pagamentos_usuarios_id_usuario",
                        column: x => x.id_usuario,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_transacoes_fixas_pagamentos_id_transacao_fixa",
                table: "transacoes_fixas_pagamentos",
                column: "id_transacao_fixa");

            migrationBuilder.CreateIndex(
                name: "IX_transacoes_fixas_pagamentos_id_usuario_id_transacao_fixa~",
                table: "transacoes_fixas_pagamentos",
                columns: new[] { "id_usuario", "id_transacao_fixa", "data_ocorrencia" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "transacoes_fixas_pagamentos");
        }
    }
}

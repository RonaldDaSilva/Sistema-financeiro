using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SistemaFinanceiro.Api.Data;

#nullable disable

namespace SistemaFinanceiro.Api.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260820143000_AddIntegracaoFinanceiraEmprestimos")]
    public partial class AddIntegracaoFinanceiraEmprestimos : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(name: "id_emprestimo", table: "transacoes", type: "uuid", nullable: true);
            migrationBuilder.AddColumn<Guid>(name: "id_parcela_emprestimo", table: "transacoes", type: "uuid", nullable: true);
            migrationBuilder.AddColumn<Guid>(name: "id_pagamento_emprestimo", table: "transacoes", type: "uuid", nullable: true);

            migrationBuilder.CreateIndex(name: "IX_transacoes_id_emprestimo", table: "transacoes", column: "id_emprestimo");
            migrationBuilder.CreateIndex(
                name: "IX_transacoes_id_parcela_emprestimo",
                table: "transacoes",
                column: "id_parcela_emprestimo",
                unique: true,
                filter: "id_parcela_emprestimo IS NOT NULL");
            migrationBuilder.CreateIndex(
                name: "IX_transacoes_id_pagamento_emprestimo",
                table: "transacoes",
                column: "id_pagamento_emprestimo",
                unique: true,
                filter: "id_pagamento_emprestimo IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_transacoes_emprestimos_id_emprestimo",
                table: "transacoes",
                column: "id_emprestimo",
                principalTable: "emprestimos",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
            migrationBuilder.AddForeignKey(
                name: "FK_transacoes_parcelas_emprestimos_id_parcela_emprestimo",
                table: "transacoes",
                column: "id_parcela_emprestimo",
                principalTable: "parcelas_emprestimos",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
            migrationBuilder.AddForeignKey(
                name: "FK_transacoes_pagamentos_emprestimos_id_pagamento_emprestimo",
                table: "transacoes",
                column: "id_pagamento_emprestimo",
                principalTable: "pagamentos_emprestimos",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey("FK_transacoes_emprestimos_id_emprestimo", "transacoes");
            migrationBuilder.DropForeignKey("FK_transacoes_parcelas_emprestimos_id_parcela_emprestimo", "transacoes");
            migrationBuilder.DropForeignKey("FK_transacoes_pagamentos_emprestimos_id_pagamento_emprestimo", "transacoes");
            migrationBuilder.DropIndex("IX_transacoes_id_emprestimo", "transacoes");
            migrationBuilder.DropIndex("IX_transacoes_id_parcela_emprestimo", "transacoes");
            migrationBuilder.DropIndex("IX_transacoes_id_pagamento_emprestimo", "transacoes");
            migrationBuilder.DropColumn("id_emprestimo", "transacoes");
            migrationBuilder.DropColumn("id_parcela_emprestimo", "transacoes");
            migrationBuilder.DropColumn("id_pagamento_emprestimo", "transacoes");
        }
    }
}

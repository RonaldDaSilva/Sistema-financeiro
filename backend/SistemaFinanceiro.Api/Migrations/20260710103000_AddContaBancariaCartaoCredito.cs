using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SistemaFinanceiro.Api.Migrations
{
    public partial class AddContaBancariaCartaoCredito : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "id_conta_bancaria",
                table: "cartoes_credito",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_cartoes_credito_id_conta_bancaria",
                table: "cartoes_credito",
                column: "id_conta_bancaria");

            migrationBuilder.AddForeignKey(
                name: "FK_cartoes_credito_contas_bancarias_id_conta_bancaria",
                table: "cartoes_credito",
                column: "id_conta_bancaria",
                principalTable: "contas_bancarias",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_cartoes_credito_contas_bancarias_id_conta_bancaria",
                table: "cartoes_credito");

            migrationBuilder.DropIndex(
                name: "IX_cartoes_credito_id_conta_bancaria",
                table: "cartoes_credito");

            migrationBuilder.DropColumn(
                name: "id_conta_bancaria",
                table: "cartoes_credito");
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using SistemaFinanceiro.Api.Data;

#nullable disable

namespace SistemaFinanceiro.Api.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260820002800_AddCompraParceladaGeradaDivisao")]
    public partial class AddCompraParceladaGeradaDivisao : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "id_compra_parcelada_gerada",
                table: "divisoes_transacoes_participantes",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_divisoes_transacoes_participantes_id_compra_parcelada_gerada",
                table: "divisoes_transacoes_participantes",
                column: "id_compra_parcelada_gerada");

            migrationBuilder.AddForeignKey(
                name: "FK_divisao_participante_compra_gerada",
                table: "divisoes_transacoes_participantes",
                column: "id_compra_parcelada_gerada",
                principalTable: "compras_parceladas",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_divisao_participante_compra_gerada",
                table: "divisoes_transacoes_participantes");

            migrationBuilder.DropIndex(
                name: "IX_divisoes_transacoes_participantes_id_compra_parcelada_gerada",
                table: "divisoes_transacoes_participantes");

            migrationBuilder.DropColumn(
                name: "id_compra_parcelada_gerada",
                table: "divisoes_transacoes_participantes");
        }
    }
}

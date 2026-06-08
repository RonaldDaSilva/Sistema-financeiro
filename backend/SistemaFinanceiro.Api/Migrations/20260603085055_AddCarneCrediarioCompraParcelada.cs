using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SistemaFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCarneCrediarioCompraParcelada : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "id_cartao_credito",
                table: "compras_parceladas",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<DateOnly>(
                name: "data_primeiro_vencimento",
                table: "compras_parceladas",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "forma_pagamento",
                table: "compras_parceladas",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "CartaoCredito");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "data_primeiro_vencimento",
                table: "compras_parceladas");

            migrationBuilder.DropColumn(
                name: "forma_pagamento",
                table: "compras_parceladas");

            migrationBuilder.AlterColumn<Guid>(
                name: "id_cartao_credito",
                table: "compras_parceladas",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }
    }
}

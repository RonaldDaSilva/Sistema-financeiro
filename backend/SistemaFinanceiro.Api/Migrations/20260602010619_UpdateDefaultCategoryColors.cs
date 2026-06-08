using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SistemaFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class UpdateDefaultCategoryColors : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "categorias",
                keyColumn: "id",
                keyValue: new Guid("06fa9f77-5ac4-42d7-aa5a-4f98a38fe692"),
                column: "cor_hexa",
                value: "#059669");

            migrationBuilder.UpdateData(
                table: "categorias",
                keyColumn: "id",
                keyValue: new Guid("0d2cc7a6-e150-433d-bc47-97b401078f86"),
                column: "cor_hexa",
                value: "#2563EB");

            migrationBuilder.UpdateData(
                table: "categorias",
                keyColumn: "id",
                keyValue: new Guid("6b7df4e6-6937-4c07-9e6f-7d19efa15177"),
                column: "cor_hexa",
                value: "#DC2626");

            migrationBuilder.UpdateData(
                table: "categorias",
                keyColumn: "id",
                keyValue: new Guid("86299a6c-6d3a-49d2-b862-9340673d0425"),
                column: "cor_hexa",
                value: "#7C3AED");

            migrationBuilder.UpdateData(
                table: "categorias",
                keyColumn: "id",
                keyValue: new Guid("c8763c27-954e-439c-9b22-7ff05356c12b"),
                column: "cor_hexa",
                value: "#EA580C");

            migrationBuilder.UpdateData(
                table: "categorias",
                keyColumn: "id",
                keyValue: new Guid("f3e02a07-08e6-47a0-824d-3acc930c537e"),
                column: "cor_hexa",
                value: "#DB2777");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "categorias",
                keyColumn: "id",
                keyValue: new Guid("06fa9f77-5ac4-42d7-aa5a-4f98a38fe692"),
                column: "cor_hexa",
                value: "#64748B");

            migrationBuilder.UpdateData(
                table: "categorias",
                keyColumn: "id",
                keyValue: new Guid("0d2cc7a6-e150-433d-bc47-97b401078f86"),
                column: "cor_hexa",
                value: "#64748B");

            migrationBuilder.UpdateData(
                table: "categorias",
                keyColumn: "id",
                keyValue: new Guid("6b7df4e6-6937-4c07-9e6f-7d19efa15177"),
                column: "cor_hexa",
                value: "#64748B");

            migrationBuilder.UpdateData(
                table: "categorias",
                keyColumn: "id",
                keyValue: new Guid("86299a6c-6d3a-49d2-b862-9340673d0425"),
                column: "cor_hexa",
                value: "#64748B");

            migrationBuilder.UpdateData(
                table: "categorias",
                keyColumn: "id",
                keyValue: new Guid("c8763c27-954e-439c-9b22-7ff05356c12b"),
                column: "cor_hexa",
                value: "#64748B");

            migrationBuilder.UpdateData(
                table: "categorias",
                keyColumn: "id",
                keyValue: new Guid("f3e02a07-08e6-47a0-824d-3acc930c537e"),
                column: "cor_hexa",
                value: "#64748B");
        }
    }
}

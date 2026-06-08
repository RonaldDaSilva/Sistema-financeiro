using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace SistemaFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class SeedDefaultCategories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "categorias",
                columns: new[] { "id", "cor_hexa", "nome", "id_usuario" },
                values: new object[,]
                {
                    { new Guid("06fa9f77-5ac4-42d7-aa5a-4f98a38fe692"), "#64748B", "📈 Investimento", null },
                    { new Guid("0d2cc7a6-e150-433d-bc47-97b401078f86"), "#64748B", "🏠 Casa", null },
                    { new Guid("6b7df4e6-6937-4c07-9e6f-7d19efa15177"), "#64748B", "🚗 Carro", null },
                    { new Guid("86299a6c-6d3a-49d2-b862-9340673d0425"), "#64748B", "📚 Educação", null },
                    { new Guid("c8763c27-954e-439c-9b22-7ff05356c12b"), "#64748B", "🍽️ Alimentação", null },
                    { new Guid("f3e02a07-08e6-47a0-824d-3acc930c537e"), "#64748B", "🎮 Lazer", null }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "categorias",
                keyColumn: "id",
                keyValue: new Guid("06fa9f77-5ac4-42d7-aa5a-4f98a38fe692"));

            migrationBuilder.DeleteData(
                table: "categorias",
                keyColumn: "id",
                keyValue: new Guid("0d2cc7a6-e150-433d-bc47-97b401078f86"));

            migrationBuilder.DeleteData(
                table: "categorias",
                keyColumn: "id",
                keyValue: new Guid("6b7df4e6-6937-4c07-9e6f-7d19efa15177"));

            migrationBuilder.DeleteData(
                table: "categorias",
                keyColumn: "id",
                keyValue: new Guid("86299a6c-6d3a-49d2-b862-9340673d0425"));

            migrationBuilder.DeleteData(
                table: "categorias",
                keyColumn: "id",
                keyValue: new Guid("c8763c27-954e-439c-9b22-7ff05356c12b"));

            migrationBuilder.DeleteData(
                table: "categorias",
                keyColumn: "id",
                keyValue: new Guid("f3e02a07-08e6-47a0-824d-3acc930c537e"));
        }
    }
}

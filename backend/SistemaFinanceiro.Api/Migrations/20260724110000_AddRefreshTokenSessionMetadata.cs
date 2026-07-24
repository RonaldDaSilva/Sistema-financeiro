using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SistemaFinanceiro.Api.Migrations
{
    public partial class AddRefreshTokenSessionMetadata : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "sessao_expira_em",
                table: "refresh_tokens",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "now() + interval '60 days'");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ultima_atividade_em",
                table: "refresh_tokens",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "now()");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "reutilizado_em",
                table: "refresh_tokens",
                type: "timestamp with time zone",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "sessao_expira_em",
                table: "refresh_tokens");

            migrationBuilder.DropColumn(
                name: "ultima_atividade_em",
                table: "refresh_tokens");

            migrationBuilder.DropColumn(
                name: "reutilizado_em",
                table: "refresh_tokens");
        }
    }
}

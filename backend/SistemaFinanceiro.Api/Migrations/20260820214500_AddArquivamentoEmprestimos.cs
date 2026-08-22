using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SistemaFinanceiro.Api.Data;

#nullable disable

namespace SistemaFinanceiro.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260820214500_AddArquivamentoEmprestimos")]
public sealed class AddArquivamentoEmprestimos : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<bool>(
            name: "is_arquivado",
            table: "emprestimos",
            type: "boolean",
            nullable: false,
            defaultValue: false);

        migrationBuilder.CreateIndex(
            name: "IX_emprestimos_id_usuario_is_arquivado",
            table: "emprestimos",
            columns: new[] { "id_usuario", "is_arquivado" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_emprestimos_id_usuario_is_arquivado",
            table: "emprestimos");
        migrationBuilder.DropColumn(name: "is_arquivado", table: "emprestimos");
    }
}

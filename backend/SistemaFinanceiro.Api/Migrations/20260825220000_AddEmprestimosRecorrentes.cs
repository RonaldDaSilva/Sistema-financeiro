using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SistemaFinanceiro.Api.Data;

#nullable disable

namespace SistemaFinanceiro.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260825220000_AddEmprestimosRecorrentes")]
public sealed class AddEmprestimosRecorrentes : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>("tipo", "emprestimos", "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Avista");
        migrationBuilder.AddColumn<DateOnly>("data_fim_recorrencia", "emprestimos", "date", nullable: true);
        migrationBuilder.AddColumn<bool>("recorrencia_ativa", "emprestimos", "boolean", nullable: false, defaultValue: false);
        migrationBuilder.Sql("UPDATE emprestimos SET tipo = 'Parcelado' WHERE quantidade_parcelas > 1;");

        migrationBuilder.AddColumn<DateOnly>("competencia", "parcelas_emprestimos", "date", nullable: true);
        migrationBuilder.Sql("UPDATE parcelas_emprestimos SET competencia = data_vencimento;");
        migrationBuilder.AlterColumn<DateOnly>("competencia", "parcelas_emprestimos", "date", nullable: false, oldClrType: typeof(DateOnly), oldType: "date", oldNullable: true);

        migrationBuilder.CreateTable(
            name: "alteracoes_recorrencias_emprestimos",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                id_usuario = table.Column<Guid>(type: "uuid", nullable: false),
                id_emprestimo = table.Column<Guid>(type: "uuid", nullable: false),
                competencia = table.Column<DateOnly>(type: "date", nullable: false),
                valor = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                escopo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                criado_em = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_alteracoes_recorrencias_emprestimos", x => x.id);
                table.ForeignKey("FK_alteracoes_recorrencias_emprestimos_emprestimos_id_emprestimo", x => x.id_emprestimo, "emprestimos", "id", onDelete: ReferentialAction.Cascade);
                table.ForeignKey("FK_alteracoes_recorrencias_emprestimos_usuarios_id_usuario", x => x.id_usuario, "usuarios", "id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex("IX_emprestimos_id_usuario_tipo_recorrencia_ativa", "emprestimos", new[] { "id_usuario", "tipo", "recorrencia_ativa" });
        migrationBuilder.CreateIndex("IX_parcelas_emprestimos_id_emprestimo_competencia", "parcelas_emprestimos", new[] { "id_emprestimo", "competencia" }, unique: true);
        migrationBuilder.CreateIndex("IX_alteracoes_recorrencias_emprestimos_id_usuario", "alteracoes_recorrencias_emprestimos", "id_usuario");
        migrationBuilder.CreateIndex("IX_alteracoes_recorrencias_emprestimos_id_emprestimo_competencia_escopo", "alteracoes_recorrencias_emprestimos", new[] { "id_emprestimo", "competencia", "escopo" }, unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable("alteracoes_recorrencias_emprestimos");
        migrationBuilder.DropIndex("IX_emprestimos_id_usuario_tipo_recorrencia_ativa", "emprestimos");
        migrationBuilder.DropIndex("IX_parcelas_emprestimos_id_emprestimo_competencia", "parcelas_emprestimos");
        migrationBuilder.DropColumn("competencia", "parcelas_emprestimos");
        migrationBuilder.DropColumn("tipo", "emprestimos");
        migrationBuilder.DropColumn("data_fim_recorrencia", "emprestimos");
        migrationBuilder.DropColumn("recorrencia_ativa", "emprestimos");
    }
}

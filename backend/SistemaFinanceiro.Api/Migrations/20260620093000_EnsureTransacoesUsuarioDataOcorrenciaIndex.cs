using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SistemaFinanceiro.Api.Migrations;

public partial class EnsureTransacoesUsuarioDataOcorrenciaIndex : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE INDEX IF NOT EXISTS "IX_transacoes_id_usuario_data_ocorrencia"
            ON transacoes (id_usuario, data_ocorrencia);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Intencionalmente vazio: este índice pode ter sido criado por migration anterior
        // em alguns ambientes. O Up usa CREATE INDEX IF NOT EXISTS para ser idempotente.
    }
}

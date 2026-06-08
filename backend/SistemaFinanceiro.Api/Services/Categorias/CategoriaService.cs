using Microsoft.EntityFrameworkCore;
using SistemaFinanceiro.Api.Data;
using SistemaFinanceiro.Api.Dtos.Categorias;
using SistemaFinanceiro.Api.Models;

namespace SistemaFinanceiro.Api.Services.Categorias;

public sealed class CategoriaService : ICategoriaService
{
    private const string DefaultCategoryColor = "#64748B";
    private static readonly string[] CategoryColorPalette =
    [
        "#2563EB",
        "#DC2626",
        "#7C3AED",
        "#DB2777",
        "#059669",
        "#EA580C",
        "#0891B2",
        "#CA8A04",
        "#4F46E5",
        "#16A34A",
        "#BE123C",
        "#9333EA",
        "#0D9488",
        "#D97706",
        "#0284C7",
        "#65A30D",
        "#C2410C",
        "#475569"
    ];

    private readonly AppDbContext _dbContext;

    public CategoriaService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<CategoriaResponse>> ListarAsync(Guid usuarioId, CancellationToken cancellationToken = default)
    {
        var categorias = await _dbContext.Categorias
            .AsNoTracking()
            .Where(categoria => categoria.UsuarioId == null || categoria.UsuarioId == usuarioId)
            .OrderBy(categoria => categoria.UsuarioId == null ? 0 : 1)
            .ThenBy(categoria => categoria.Nome)
            .ToListAsync(cancellationToken);

        return categorias.Select(Mapear).ToList();
    }

    public async Task<CategoriaResponse?> ObterPorIdAsync(Guid id, Guid usuarioId, CancellationToken cancellationToken = default)
    {
        var categoria = await BuscarCategoriaAcessivel(id, usuarioId, cancellationToken);
        return categoria is null ? null : Mapear(categoria);
    }

    public async Task<CategoriaResponse> CriarAsync(CategoriaRequest request, Guid usuarioId, CancellationToken cancellationToken = default)
    {
        var categoria = new Categoria
        {
            UsuarioId = usuarioId,
            Nome = request.Nome.Trim(),
            CorHexa = await EscolherCorAsync(usuarioId, request.CorHexa, cancellationToken)
        };

        _dbContext.Categorias.Add(categoria);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Mapear(categoria);
    }

    public async Task<CategoriaResponse?> AtualizarAsync(
        Guid id,
        CategoriaRequest request,
        Guid usuarioId,
        CancellationToken cancellationToken = default)
    {
        var categoria = await BuscarCategoriaAcessivel(id, usuarioId, cancellationToken);
        if (categoria is null)
        {
            return null;
        }

        if (categoria.UsuarioId is null)
        {
            var clone = new Categoria
            {
                UsuarioId = usuarioId,
                Nome = request.Nome.Trim(),
                CorHexa = await EscolherCorAsync(usuarioId, request.CorHexa, cancellationToken)
            };

            _dbContext.Categorias.Add(clone);
            await _dbContext.SaveChangesAsync(cancellationToken);
            return Mapear(clone);
        }

        categoria.Nome = request.Nome.Trim();
        categoria.CorHexa = string.IsNullOrWhiteSpace(request.CorHexa)
            ? categoria.CorHexa
            : request.CorHexa.Trim();

        await _dbContext.SaveChangesAsync(cancellationToken);
        return Mapear(categoria);
    }

    public async Task<bool> ExcluirAsync(Guid id, Guid usuarioId, CancellationToken cancellationToken = default)
    {
        var categoria = await BuscarCategoriaAcessivel(id, usuarioId, cancellationToken);
        if (categoria is null)
        {
            return false;
        }

        if (categoria.UsuarioId is null)
        {
            throw new InvalidOperationException("Categorias padrão globais não podem ser excluídas.");
        }

        _dbContext.Categorias.Remove(categoria);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private async Task<Categoria?> BuscarCategoriaAcessivel(Guid id, Guid usuarioId, CancellationToken cancellationToken)
    {
        return await _dbContext.Categorias
            .SingleOrDefaultAsync(
                categoria => categoria.Id == id && (categoria.UsuarioId == null || categoria.UsuarioId == usuarioId),
                cancellationToken);
    }

    private static CategoriaResponse Mapear(Categoria categoria)
    {
        return new CategoriaResponse
        {
            Id = categoria.Id,
            UsuarioId = categoria.UsuarioId,
            Nome = categoria.Nome,
            CorHexa = categoria.CorHexa,
            IsDefault = categoria.UsuarioId is null
        };
    }

    private async Task<string> EscolherCorAsync(
        Guid usuarioId,
        string? corHexa,
        CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(corHexa))
        {
            return corHexa.Trim();
        }

        var coresUsadas = await _dbContext.Categorias
            .AsNoTracking()
            .Where(categoria => categoria.UsuarioId == null || categoria.UsuarioId == usuarioId)
            .Select(categoria => categoria.CorHexa.ToUpper())
            .ToListAsync(cancellationToken);

        var coresUsadasSet = coresUsadas.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var corDisponivel = CategoryColorPalette
            .FirstOrDefault(cor => !coresUsadasSet.Contains(cor));

        if (corDisponivel is not null)
        {
            return corDisponivel;
        }

        var index = Math.Abs(HashCode.Combine(usuarioId, coresUsadas.Count)) % CategoryColorPalette.Length;
        return CategoryColorPalette.ElementAtOrDefault(index) ?? DefaultCategoryColor;
    }
}

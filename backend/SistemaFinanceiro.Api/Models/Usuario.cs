using SistemaFinanceiro.Api.Models.Common;

namespace SistemaFinanceiro.Api.Models;

public sealed class Usuario : IHasGuidId
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Nome { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string SenhaHash { get; set; } = string.Empty;
    public string? Telefone { get; set; }
    public string? Cpf { get; set; }
    public DateTimeOffset CriadoEm { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<Categoria> Categorias { get; set; } = new List<Categoria>();
    public ICollection<CartaoCredito> CartoesCredito { get; set; } = new List<CartaoCredito>();
    public ICollection<ContaBancaria> ContasBancarias { get; set; } = new List<ContaBancaria>();
    public ICollection<CompraParcelada> ComprasParceladas { get; set; } = new List<CompraParcelada>();
    public ICollection<Transacao> Transacoes { get; set; } = new List<Transacao>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
    public ICollection<Notificacao> Notificacoes { get; set; } = new List<Notificacao>();
    public ICollection<FaturaCartaoPagamento> FaturasCartaoPagamentos { get; set; } = new List<FaturaCartaoPagamento>();
    public ConfiguracoesUsuario? Configuracoes { get; set; }
}

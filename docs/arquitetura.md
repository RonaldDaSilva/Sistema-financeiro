# Arquitetura do Sistema

## Visao Geral

O sistema e dividido em duas aplicacoes principais:

- `backend/SistemaFinanceiro.Api`: API REST em .NET 8 responsavel por autenticacao, regras financeiras, multi-tenancy, persistencia e exportacao.
- `frontend`: SPA React com Vite e TypeScript responsavel pela experiencia do usuario, dashboards, graficos, filtros e downloads.

## Multi-Tenant

Cada registro de dominio do usuario possui `IdUsuario`. As entidades que pertencem a um usuario implementam a interface de tenant, e o `AppDbContext` aplica Global Query Filter para reduzir o risco de vazamento entre contas.

Categorias globais usam `IdUsuario` nulo. Ao editar uma categoria global, o backend cria uma copia personalizada para o usuario em vez de alterar o registro padrao.

## Motor Financeiro

O extrato nao e apenas uma consulta direta de transacoes. O backend monta a visao financeira combinando:

- Transacoes reais do periodo.
- Receitas e despesas fixas projetadas.
- Parcelas virtuais de compras parceladas.
- Parcelas de carne/crediario pela data de vencimento.
- Faturas consolidadas de cartao de credito conforme fechamento.

Essa regra centralizada no backend garante que dashboard, relatorios e exportacoes enxerguem a mesma realidade financeira.

## Cartao de Credito

Compras no credito nao devem aparecer soltas no fluxo de caixa pela data da compra. O sistema consolida as compras por fatura, usando `MelhorDiaCompra` como fechamento e `DiaVencimento` como vencimento.

## Exportacoes

As exportacoes Excel/PDF sao geradas no backend para reaproveitar o motor de projecao. Os filtros enviados pela tela de inicio sao aplicados antes da geracao do arquivo.


# Sistema Financeiro

Aplicacao financeira full stack com backend em C#/.NET 8, PostgreSQL e frontend React + TypeScript. O sistema foi construido para controle multiusuario, com isolamento por usuario, autenticacao JWT, lancamentos recorrentes, compras parceladas, faturas consolidadas de cartao, relatorios e exportacao em Excel/PDF.

## Stack

- Backend: .NET 8, ASP.NET Core Web API, Entity Framework Core
- Banco: PostgreSQL
- Frontend: React, Vite, TypeScript, Tailwind CSS
- Autenticacao: JWT com refresh token
- Relatorios: Recharts no frontend, ClosedXML e QuestPDF no backend

## Funcionalidades

- Cadastro, login e perfil de usuario com CPF opcional e validacao matematica.
- Multi-tenant por `IdUsuario`, com Global Query Filter no `AppDbContext`.
- Transacoes de receita, despesa e investimento.
- Compras parceladas com projecao virtual.
- Carnes/crediarios com vencimento da primeira parcela configuravel.
- Despesas e receitas fixas projetadas dinamicamente.
- Fatura consolidada de cartao de credito por competencia de fechamento.
- Categorias globais e personalizadas, com clonagem ao editar categoria padrao.
- Cartoes de credito com limite e melhor dia de compra.
- Notificacoes in-app para vencimentos e melhor dia de compra.
- Filtros por periodo, tipo e categoria.
- Exportacao do extrato filtrado para Excel e PDF.
- Temas claro/escuro e paletas visuais salvas no local storage.

## Configuracao Local

### Backend

1. Copie o arquivo de exemplo:

```powershell
Copy-Item backend/SistemaFinanceiro.Api/appsettings.example.json backend/SistemaFinanceiro.Api/appsettings.json
```

2. Ajuste `ConnectionStrings:DefaultConnection` e `Jwt` no `appsettings.json`.

3. Restaure pacotes, aplique migrations e rode a API:

```powershell
cd backend/SistemaFinanceiro.Api
$env:DOTNET_ROLL_FORWARD="Major"
dotnet restore
dotnet ef database update
dotnet run --urls http://localhost:5000
```

### Frontend

1. Instale dependencias:

```powershell
cd frontend
npm install
```

2. Configure a URL da API, se necessario, em `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

3. Inicie o Vite:

```powershell
npm run dev -- --host 127.0.0.1
```

## URLs

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://localhost:5000`
- Health check: `http://localhost:5000/health`

## Seguranca

Arquivos locais com senhas, secrets e logs nao devem ser versionados. O `.gitignore` deste projeto ignora `appsettings.json`, arquivos `.env`, logs, `node_modules`, `dist`, `bin` e `obj`.

Para publicar em outro ambiente, configure segredos por variaveis de ambiente, secret manager ou mecanismo seguro da plataforma.

## Comandos Uteis

```powershell
# Backend
dotnet build
dotnet ef migrations add NomeDaMigration
dotnet ef database update

# Frontend
npm run build
npm run dev
```


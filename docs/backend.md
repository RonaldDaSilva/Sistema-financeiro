# Backend

## Estrutura

- `Controllers`: endpoints REST.
- `Data`: `AppDbContext` e configuracoes do EF Core.
- `Dtos`: contratos de entrada e saida da API.
- `Models`: entidades persistidas.
- `Services`: regras de negocio e integracoes internas.
- `Migrations`: historico de schema do PostgreSQL.
- `Utils`: validadores e funcoes auxiliares.

## Autenticacao

O login retorna JWT e refresh token. Senhas sao armazenadas com hash usando ferramentas nativas do .NET, nunca em texto puro.

## CPF

O CPF e opcional para permitir acesso de usuarios antigos ou contas criadas sem essa informacao. Quando informado:

- A pontuacao e removida.
- O algoritmo matematico oficial de CPF e validado.
- O banco bloqueia duplicidade por indice unico.

No PostgreSQL, indices unicos permitem multiplos valores `NULL`, entao usuarios sem CPF podem coexistir ate preencherem o dado.

## Notificacoes

O sistema possui entidades de notificacao e configuracao do usuario. Uma rotina diaria verifica vencimentos, faturas e melhor dia de compra, respeitando as preferencias do usuario.

## Relatorios

O `ExportacaoService` gera:

- Excel com ClosedXML.
- PDF com QuestPDF.

Ambos usam os dados consolidados do `TransacaoService`.


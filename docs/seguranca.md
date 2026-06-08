# Seguranca e Dados Sensíveis

## Nao Versionar

Nao inclua no Git:

- `appsettings.json`
- `.env` e variantes locais
- logs
- dumps de banco
- `node_modules`
- `dist`
- `bin` e `obj`

## Segredos

Credenciais de banco, chaves JWT e secrets devem ser configurados por ambiente. O arquivo `appsettings.example.json` existe apenas como modelo sem dados reais.

## Isolamento

O backend deve sempre obter o usuario autenticado pelo token JWT. Consultas de entidades com tenant devem passar pelo `AppDbContext` com Global Query Filter ativo.

## Boas Praticas

- Nunca armazenar senha em texto puro.
- Validar dados sensiveis no backend, mesmo quando houver mascara no frontend.
- Conferir migrations antes de aplicar em producao.
- Revisar arquivos staged antes de cada commit.


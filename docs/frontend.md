# Frontend

## Estrutura

- `src/components`: componentes reutilizaveis.
- `src/pages`: telas principais.
- `src/services`: clientes Axios e chamadas de API.
- `src/contexts`: contexto de autenticacao.
- `src/types`: tipagens TypeScript compartilhadas.
- `src/utils`: mascaras, datas e paletas.
- `src/styles`: estilos globais Tailwind.

## Autenticacao

O `AuthContext` guarda a sessao do usuario e o token JWT. O Axios usa interceptor para enviar `Authorization: Bearer <token>` nas requisicoes autenticadas.

## Layout

O sistema usa Tailwind CSS, lucide-react para icones e paletas selecionaveis pelo usuario. A preferencia visual fica armazenada no local storage.

## Modais

Confirmacoes e validacoes visuais usam componentes de modal do proprio sistema, evitando `alert` e `confirm` nativos do navegador.

## Exportacao

A tela de inicio baixa Excel/PDF via Axios com `responseType: "blob"` e cria uma URL temporaria para disparar o download no navegador.


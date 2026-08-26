import { describe, expect, it } from "vitest";
import { queryKeys } from "./queryKeys";

describe("queryKeys.relatorios", () => {
  it("mantém uma chave separada para opções leves de cartões", () => {
    expect(queryKeys.cartoesOpcoes).toEqual(["cartoes", "opcoes"]);
    expect(queryKeys.cartoesOpcoes).not.toEqual(queryKeys.cartoes);
  });

  it("separa listas de empréstimos por pessoa", () => {
    expect(queryKeys.emprestimos(null)).toEqual(["emprestimos", "lista", "todos", "ativos"]);
    expect(queryKeys.emprestimos("contato-1")).toEqual([
      "emprestimos",
      "lista",
      "contato-1",
      "ativos",
    ]);
    expect(queryKeys.emprestimos(null)).not.toEqual(queryKeys.emprestimos("contato-1"));
    expect(queryKeys.emprestimos(null, true)).toEqual([
      "emprestimos",
      "lista",
      "todos",
      "com-arquivados",
    ]);
  });

  it("separa o resumo de empréstimos por competência, pessoa e página", () => {
    expect(queryKeys.resumoEmprestimosMensal(8, 2026, null)).toEqual([
      "emprestimos",
      "resumo-mensal",
      2026,
      8,
      "todos",
      "ativos",
      1,
    ]);
    expect(queryKeys.resumoEmprestimosMensal(8, 2026, "contato-1", false, 2))
      .not.toEqual(queryKeys.resumoEmprestimosMensal(8, 2026, null));
  });

  it("inclui secoes normalizadas para preservar cache por aba", () => {
    const keyA = queryKeys.relatorios(
      "2026-01-01",
      "2026-07-31",
      "",
      "",
      ["cat-b", "cat-a"],
      "todos",
      "todos",
      false,
      false,
      ["projecao", "resumo"],
    );
    const keyB = queryKeys.relatorios(
      "2026-01-01",
      "2026-07-31",
      "",
      "",
      ["cat-a", "cat-b"],
      "todos",
      "todos",
      false,
      false,
      ["resumo", "projecao"],
    );

    expect(keyA).toEqual(keyB);
    expect(keyA[1]).toBe("projecao,resumo");
    expect(keyA[6]).toBe("cat-a,cat-b");
  });

  it("gera chaves diferentes para abas diferentes com os mesmos filtros", () => {
    const criarKey = (secoes: string[]) => queryKeys.relatorios(
      "2026-01-01",
      "2026-07-31",
      "",
      "",
      [],
      "todos",
      "todos",
      false,
      false,
      secoes,
    );

    expect(criarKey(["resumo"])).not.toEqual(criarKey(["compromissos"]));
  });
});

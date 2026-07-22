import { describe, expect, it } from "vitest";
import { queryKeys } from "./queryKeys";

describe("queryKeys.relatorios", () => {
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

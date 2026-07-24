import { describe, expect, it } from "vitest";
import { sanitizeInternalRedirect } from "./redirect";

describe("sanitizeInternalRedirect", () => {
  it("preserva caminhos internos com query e hash", () => {
    expect(sanitizeInternalRedirect("/transacoes/nova?origem=atalho#form")).toBe(
      "/transacoes/nova?origem=atalho#form",
    );
  });

  it("bloqueia URLs absolutas e protocolo relativo", () => {
    expect(sanitizeInternalRedirect("https://evil.example/login")).toBe("/");
    expect(sanitizeInternalRedirect("//evil.example/login")).toBe("/");
  });

  it("bloqueia esquemas perigosos e usa fallback", () => {
    expect(sanitizeInternalRedirect("javascript:alert(1)")).toBe("/");
    expect(sanitizeInternalRedirect("data:text/html,teste")).toBe("/");
    expect(sanitizeInternalRedirect("")).toBe("/");
  });
});

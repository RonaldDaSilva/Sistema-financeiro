import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../contexts/authContextCore";
import { ProtectedRoute } from "./ProtectedRoute";

function renderRoute(auth: Partial<AuthContextValue>) {
  const value: AuthContextValue = {
    user: null,
    session: null,
    isAuthenticated: false,
    isAuthRestoring: false,
    login: vi.fn(),
    register: vi.fn(),
    updateUser: vi.fn(),
    logout: vi.fn(),
    ...auth,
  };

  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={["/transacoes/nova?origem=atalho"]}>
        <Routes>
          <Route
            path="/transacoes/nova"
            element={
              <ProtectedRoute>
                <div>Rota protegida</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("ProtectedRoute", () => {
  it("mostra restauração e não redireciona prematuramente", () => {
    renderRoute({ isAuthRestoring: true });

    expect(screen.getByRole("status", { name: "Restaurando sessão" })).toBeInTheDocument();
    expect(screen.queryByText("Login")).not.toBeInTheDocument();
  });

  it("redireciona ao login quando não está autenticado", () => {
    renderRoute({ isAuthRestoring: false, isAuthenticated: false });

    expect(screen.getByText("Login")).toBeInTheDocument();
  });

  it("renderiza a rota quando autenticado", () => {
    renderRoute({ isAuthRestoring: false, isAuthenticated: true });

    expect(screen.getByText("Rota protegida")).toBeInTheDocument();
  });
});

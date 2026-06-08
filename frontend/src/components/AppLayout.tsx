import { useEffect, useRef, useState } from "react";
import { LogOut, Moon, Settings, User, Wallet } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { applyPalette, getStoredPaletteId } from "../utils/palette";
import { NotificationBell } from "./NotificationBell";

type AppLayoutProps = {
  children: React.ReactNode;
};

const navItems = [
  { to: "/", label: "Início" },
  { to: "/relatorios", label: "Relatórios" },
  { to: "/cartoes", label: "Cartões" },
  { to: "/categorias", label: "Categorias" },
];

function applyTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("theme", theme);
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const stored = localStorage.getItem("theme");
    return stored === "dark" ? "dark" : "light";
  });
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    applyTheme(theme);
    applyPalette(getStoredPaletteId());
  }, [theme]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <main
      className="min-h-screen font-sans text-slate-800 selection:bg-slate-900 selection:text-white dark:bg-slate-950 dark:text-slate-100"
      style={{ background: theme === "dark" ? undefined : "var(--app-bg)" }}
    >
      <header
        className="sticky top-0 z-30 border-b px-6 py-3 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/85"
        style={{
          background:
            theme === "dark"
              ? undefined
              : "color-mix(in srgb, var(--app-header) 82%, transparent)",
          borderColor: theme === "dark" ? undefined : "var(--app-border)",
        }}
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4">
          <NavLink
            className="flex items-center gap-2 rounded-2xl outline-none transition-opacity hover:opacity-85"
            to="/"
            aria-label="Ir para a tela inicial"
          >
            <div className="rounded-xl bg-slate-900 p-2 text-white shadow-sm dark:bg-white dark:text-slate-950">
              <Wallet size={20} />
            </div>
            <h1 className="hidden text-xl font-black tracking-tight text-slate-900 dark:text-white sm:block">
              Financeiro
            </h1>
          </NavLink>

          <nav className="hidden items-center space-x-2 rounded-2xl bg-slate-100/60 p-1 dark:bg-slate-800/70 md:flex">
            {navItems.map((item) => (
              <NavLink
                className={({ isActive }) =>
                  `rounded-xl px-5 py-2 text-sm font-bold transition-all duration-200 ${
                    isActive
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white"
                      : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                  }`
                }
                key={item.to}
                to={item.to}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center space-x-3">
            <NotificationBell />
            <div className="relative" ref={menuRef}>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus:ring-white"
                type="button"
                onClick={() => setIsMenuOpen((current) => !current)}
                aria-label="Menu do usuário"
              >
                {getInitials(user?.nome)}
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 z-50 mt-3 w-64 overflow-hidden rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] shadow-xl dark:border-slate-800 dark:bg-slate-900">
                  <div className="border-b border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {user?.nome}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {user?.email}
                    </p>
                  </div>
                  <div className="space-y-1 p-2">
                    <NavLink
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
                      to="/perfil"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <User size={16} />
                      Perfil do usuário
                    </NavLink>
                    <NavLink
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
                      to="/configuracoes"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Settings size={16} />
                      Configurações
                    </NavLink>
                    <button
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
                      type="button"
                      role="switch"
                      aria-checked={theme === "dark"}
                      onClick={() => {
                        setTheme((current) => {
                          const nextTheme =
                            current === "dark" ? "light" : "dark";
                          applyTheme(nextTheme);
                          return nextTheme;
                        });
                      }}
                    >
                      <span className="flex items-center gap-3">
                        <Moon size={16} />
                        Tema escuro
                      </span>
                      <span
                        className={`relative h-6 w-11 rounded-full transition-colors ${
                          theme === "dark"
                            ? "bg-slate-900 dark:bg-white"
                            : "bg-slate-200 dark:bg-slate-700"
                        }`}
                      >
                        <span
                          className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform dark:bg-slate-950 ${
                            theme === "dark" ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </span>
                    </button>
                  </div>
                  <div className="border-t border-slate-100 p-2 dark:border-slate-800">
                    <button
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-red-600 transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
                      type="button"
                      onClick={logout}
                    >
                      <LogOut size={16} />
                      Sair
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      {children}
    </main>
  );
}

function getInitials(name?: string) {
  if (!name?.trim()) {
    return "US";
  }

  const parts = name.trim().split(/\s+/u);
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

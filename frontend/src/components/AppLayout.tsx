import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  CreditCard,
  ChevronLeft,
  ChevronRight,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings,
  User,
  Wallet,
  BarChart3,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { applyPalette, getStoredPaletteId } from "../utils/palette";
import { NotificationBell } from "./NotificationBell";

type AppLayoutProps = {
  children: React.ReactNode;
};

const navItems = [
  { to: "/", label: "Início", Icon: LayoutDashboard },
  { to: "/relatorios", label: "Relatórios", Icon: BarChart3 },
  { to: "/cartoes", label: "Cartões", Icon: CreditCard },
  { to: "/categorias", label: "Categorias", Icon: FolderTree },
];

function applyTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("theme", theme);
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const stored = localStorage.getItem("theme");
    return stored === "dark" ? "dark" : "light";
  });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const sidebarMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    applyTheme(theme);
    applyPalette(getStoredPaletteId());
  }, [theme]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const clickedMobileMenu = menuRef.current?.contains(target);
      const clickedSidebarMenu = sidebarMenuRef.current?.contains(target);

      if (!clickedMobileMenu && !clickedSidebarMenu) {
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
        className="sticky top-0 z-30 border-b px-6 py-3 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/85 md:hidden"
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

      <div className="md:flex md:h-screen md:overflow-hidden">
        <aside
          className={`relative hidden shrink-0 flex-col border-r border-[color:var(--app-card-border)] bg-[var(--app-card)] transition-[width] duration-300 dark:border-slate-800 dark:bg-slate-900 md:flex ${
            isSidebarCollapsed ? "w-24" : "w-80"
          }`}
        >
          <button
            className="absolute -right-4 top-24 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--app-card-border)] bg-[var(--app-card)] text-slate-500 shadow-lg transition hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white"
            type="button"
            aria-label={
              isSidebarCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"
            }
            onClick={() => setIsSidebarCollapsed((current) => !current)}
          >
            {isSidebarCollapsed ? (
              <ChevronRight size={18} />
            ) : (
              <ChevronLeft size={18} />
            )}
          </button>

          <div className="flex h-full flex-col overflow-visible p-5">
            <NavLink
              className={`group mb-8 flex items-center gap-4 rounded-3xl outline-none transition hover:opacity-90 ${
                isSidebarCollapsed ? "justify-center" : ""
              }`}
              to="/"
              aria-label="Ir para a tela inicial"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--app-primary-soft)] text-[var(--app-primary)] shadow-sm dark:bg-slate-800 dark:text-white">
                <Wallet size={26} />
              </div>
              {!isSidebarCollapsed && (
                <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  Financeiro
                </span>
              )}
              {isSidebarCollapsed && (
                <span className="pointer-events-none absolute left-full ml-3 rounded-xl bg-slate-950 px-3 py-2 text-sm font-bold text-white opacity-0 shadow-xl transition group-hover:opacity-100">
                  Financeiro
                </span>
              )}
            </NavLink>

            <nav className="flex flex-1 flex-col gap-2">
              {navItems.map(({ to, label, Icon }) => (
                <NavLink
                  className={({ isActive }) =>
                    `group relative flex min-h-14 items-center gap-4 rounded-2xl px-4 text-sm font-bold transition-all ${
                      isSidebarCollapsed ? "justify-center px-0" : ""
                    } ${
                      isActive
                        ? "border-l-4 border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,white)] text-[var(--app-accent)] shadow-[0_14px_34px_rgba(15,23,42,0.12)] ring-1 ring-[color:var(--app-card-border)] dark:border-emerald-400 dark:bg-emerald-500/15 dark:text-emerald-300 dark:shadow-[0_16px_42px_rgba(16,185,129,0.18)] dark:ring-emerald-400/20"
                        : "text-slate-500 shadow-[0_8px_22px_rgba(15,23,42,0.04)] hover:bg-[var(--app-card-muted)] hover:text-slate-900 hover:shadow-[0_12px_30px_rgba(15,23,42,0.09)] dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white dark:hover:shadow-[0_12px_30px_rgba(0,0,0,0.22)]"
                    }`
                  }
                  key={to}
                  to={to}
                  end={to === "/"}
                >
                  <Icon size={22} strokeWidth={2.1} />
                  {!isSidebarCollapsed && <span>{label}</span>}
                  {isSidebarCollapsed && (
                    <span className="pointer-events-none absolute left-full ml-4 whitespace-nowrap rounded-xl bg-slate-950 px-3 py-2 text-sm font-bold text-white opacity-0 shadow-xl transition group-hover:opacity-100">
                      {label}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>

            <div className="border-t border-[color:var(--app-card-border)] pt-4 dark:border-slate-800">
              <div
                className={`mb-3 flex items-center ${
                  isSidebarCollapsed ? "justify-center" : "justify-between"
                }`}
              >
                {!isSidebarCollapsed && (
                  <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
                    Notificações
                  </span>
                )}
                <NotificationBell />
              </div>

              <div className="relative" ref={sidebarMenuRef}>
                <button
                  className={`flex w-full items-center gap-3 rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card-muted)] p-3 text-left transition hover:border-[var(--app-primary)] dark:border-slate-800 dark:bg-slate-950 ${
                    isSidebarCollapsed ? "justify-center" : ""
                  }`}
                  type="button"
                  onClick={() => setIsMenuOpen((current) => !current)}
                  aria-label="Menu do usuário"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-black text-white dark:bg-white dark:text-slate-950">
                    {getInitials(user?.nome)}
                  </span>
                  {!isSidebarCollapsed && (
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">
                        {user?.nome}
                      </span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                        Ver perfil
                      </span>
                    </span>
                  )}
                </button>

                {isMenuOpen && (
                  <UserFloatingMenu
                    className="absolute bottom-0 left-full z-50 ml-4 w-64"
                    logout={logout}
                    setIsMenuOpen={setIsMenuOpen}
                    setTheme={setTheme}
                    theme={theme}
                    user={user}
                  />
                )}
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0 md:h-screen md:flex-1 md:overflow-y-auto">
          <div className="pb-24 md:pb-0">{children}</div>
        </div>
      </div>

      <nav className="fixed inset-x-3 bottom-4 z-40 rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)]/95 p-2 shadow-2xl shadow-slate-900/15 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95 md:hidden">
        <div className="grid grid-cols-4 gap-1">
          {navItems.map(({ to, label, Icon }) => (
            <NavLink
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-bold transition-all ${
                  isActive
                    ? "bg-slate-950 text-white shadow-md shadow-slate-900/20 dark:bg-white dark:text-slate-950"
                    : "text-slate-500 hover:bg-[var(--app-card-muted)] hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                }`
              }
              key={to}
              to={to}
              end={to === "/"}
            >
              <Icon size={20} strokeWidth={2.2} />
              <span className="leading-none">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
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

type UserFloatingMenuProps = {
  className: string;
  user?: {
    nome?: string;
    email?: string;
  } | null;
  theme: "light" | "dark";
  setTheme: Dispatch<SetStateAction<"light" | "dark">>;
  setIsMenuOpen: Dispatch<SetStateAction<boolean>>;
  logout: () => void;
};

function UserFloatingMenu({
  className,
  user,
  theme,
  setTheme,
  setIsMenuOpen,
  logout,
}: UserFloatingMenuProps) {
  return (
    <div
      className={`${className} overflow-hidden rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] shadow-2xl dark:border-slate-800 dark:bg-slate-900`}
    >
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
              const nextTheme = current === "dark" ? "light" : "dark";
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
  );
}

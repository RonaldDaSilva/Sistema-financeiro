import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "../components/AppLayout";
import { useConfirmDialog } from "../components/ConfirmDialog";
import { useAuth } from "../contexts/AuthContext";
import * as notificationService from "../services/notificationService";
import * as userService from "../services/userService";
import type { ConfiguracoesNotificacao } from "../types/notification";
import {
  appPalettes,
  applyPalette,
  getStoredPaletteId,
  type AppPaletteId,
} from "../utils/palette";

export function SettingsPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { confirm, dialog } = useConfirmDialog();
  const [selectedPalette, setSelectedPalette] = useState<AppPaletteId>(() =>
    getStoredPaletteId(),
  );
  const [notificationConfig, setNotificationConfig] =
    useState<ConfiguracoesNotificacao>({
      receberNotificacoes: true,
      avisarVencimento: true,
      avisarMelhorDia: true,
      diasAntecedenciaVencimento: 2,
    });
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [senhaExclusao, setSenhaExclusao] = useState("");
  const [confirmacaoExclusao, setConfirmacaoExclusao] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    notificationService
      .obterConfiguracoes()
      .then(setNotificationConfig)
      .catch(() =>
        setError("Não foi possível carregar as configurações de notificações."),
      );
  }, []);

  function handleSelectPalette(paletteId: AppPaletteId) {
    setSelectedPalette(paletteId);
    applyPalette(paletteId);
    setMessage("Combinação de cores atualizada.");
    setError(null);
  }

  async function handleSalvarNotificacoes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setIsSavingNotifications(true);

    try {
      const nextConfig = await notificationService.atualizarConfiguracoes(
        notificationConfig,
      );

      setNotificationConfig(nextConfig);
      setMessage("Configurações de notificações atualizadas.");
    } catch (requestError) {
      setError(
        extractMessage(
          requestError,
          "Não foi possível salvar as configurações de notificações.",
        ),
      );
    } finally {
      setIsSavingNotifications(false);
    }
  }

  async function handleExcluirConta(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const confirmed = await confirm({
      title: "Excluir conta",
      message:
        "Excluir sua conta apagará seus dados financeiros. Esta ação não pode ser desfeita. Continuar?",
      confirmLabel: "Excluir conta",
      variant: "danger",
    });
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    try {
      await userService.excluirConta({
        senha: senhaExclusao,
        confirmacao: confirmacaoExclusao,
      });

      logout();
      navigate("/login", { replace: true });
    } catch (requestError) {
      setError(extractMessage(requestError, "Não foi possível excluir sua conta."));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <AppLayout>
      <section className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Conta
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Configurações
          </h2>
        </div>

        {message && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Combinação de cores
          </h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {appPalettes.map((palette) => (
              <button
                className={`rounded-2xl border-2 p-4 text-left transition ${
                  selectedPalette === palette.id
                    ? "border-slate-900 ring-2 ring-slate-900 dark:border-white dark:ring-white"
                    : "border-slate-200 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
                }`}
                key={palette.id}
                type="button"
                onClick={() => handleSelectPalette(palette.id)}
              >
                <div className="flex items-center gap-2">
                  {Object.values(palette.colors).slice(0, 4).map((color) => (
                    <span
                      className="h-6 w-6 rounded-full border border-slate-200"
                      key={color}
                      style={{ background: color }}
                    />
                  ))}
                </div>
                <p className="mt-3 font-semibold text-slate-900 dark:text-white">
                  {palette.name}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {palette.description}
                </p>
              </button>
            ))}
          </div>
        </section>

        <form
          className="rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          onSubmit={handleSalvarNotificacoes}
        >
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Notificações
          </h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <ToggleField
              checked={notificationConfig.receberNotificacoes}
              label="Receber notificações"
              onChange={(checked) =>
                setNotificationConfig((current) => ({
                  ...current,
                  receberNotificacoes: checked,
                }))
              }
            />
            <ToggleField
              checked={notificationConfig.avisarVencimento}
              disabled={!notificationConfig.receberNotificacoes}
              label="Avisar vencimentos"
              onChange={(checked) =>
                setNotificationConfig((current) => ({
                  ...current,
                  avisarVencimento: checked,
                }))
              }
            />
            <ToggleField
              checked={notificationConfig.avisarMelhorDia}
              disabled={!notificationConfig.receberNotificacoes}
              label="Avisar melhor dia de compra"
              onChange={(checked) =>
                setNotificationConfig((current) => ({
                  ...current,
                  avisarMelhorDia: checked,
                }))
              }
            />
            <label
              className={`block ${
                !notificationConfig.receberNotificacoes
                  ? "pointer-events-none opacity-50"
                  : ""
              }`}
            >
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Dias de antecedência
              </span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                type="number"
                disabled={!notificationConfig.receberNotificacoes}
                min={0}
                max={30}
                value={notificationConfig.diasAntecedenciaVencimento}
                onChange={(event) =>
                  setNotificationConfig((current) => ({
                    ...current,
                    diasAntecedenciaVencimento: Number(event.target.value),
                  }))
                }
                required
              />
            </label>
          </div>
          <div className="mt-5 flex justify-end">
            <button
              className="rounded-xl bg-[var(--app-accent)] px-6 py-2.5 font-medium text-[var(--app-accent-contrast)] shadow-sm disabled:opacity-60 dark:bg-white dark:text-slate-950"
              disabled={isSavingNotifications}
              type="submit"
            >
              {isSavingNotifications ? "Salvando..." : "Salvar notificações"}
            </button>
          </div>
        </form>

        <form
          className="rounded-3xl border border-red-200 bg-[var(--app-card)] p-8 shadow-sm dark:border-red-900 dark:bg-slate-900"
          onSubmit={handleExcluirConta}
        >
          <h3 className="text-lg font-semibold text-red-700 dark:text-red-300">
            Excluir conta
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Digite EXCLUIR e informe sua senha para confirmar.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Confirmação
              </span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-red-700 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                value={confirmacaoExclusao}
                onChange={(event) => setConfirmacaoExclusao(event.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Senha
              </span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-red-700 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                type="password"
                value={senhaExclusao}
                onChange={(event) => setSenhaExclusao(event.target.value)}
                required
              />
            </label>
          </div>
          <div className="mt-5 flex justify-end">
            <button
              className="rounded-xl bg-red-700 px-6 py-2.5 font-medium text-white shadow-sm disabled:opacity-60"
              disabled={isDeleting}
              type="submit"
            >
              {isDeleting ? "Excluindo..." : "Excluir conta"}
            </button>
          </div>
        </form>
      </section>
      {dialog}
    </AppLayout>
  );
}

type ToggleFieldProps = {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
};

function ToggleField({
  checked,
  disabled,
  label,
  onChange,
}: ToggleFieldProps) {
  return (
    <label
      className={`flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950 ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      }`}
    >
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </span>
      <input
        checked={checked}
        className="h-5 w-5"
        disabled={disabled}
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function extractMessage(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "message" in error.response.data &&
    typeof error.response.data.message === "string"
  ) {
    return error.response.data.message;
  }

  return fallback;
}

import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "../components/AppLayout";
import { useConfirmDialog } from "../components/ConfirmDialog";
import { useAuth } from "../contexts/useAuth";
import { queryKeys } from "../hooks/queries/queryKeys";
import { useConfiguracoesNotificacao } from "../hooks/queries/useNotificationQueries";
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
  const queryClient = useQueryClient();
  const { confirm, dialog } = useConfirmDialog();
  const configuracoesQuery = useConfiguracoesNotificacao();
  const [selectedPalette, setSelectedPalette] = useState<AppPaletteId>(() =>
    getStoredPaletteId(),
  );
  const [notificationConfig, setNotificationConfig] =
    useState<ConfiguracoesNotificacao>({
      receberNotificacoes: true,
      avisarVencimento: true,
      avisarMelhorDia: true,
      diasAntecedenciaVencimento: 2,
      percentualPadraoDivisao: 50,
    });
  const [diasAntecedenciaInput, setDiasAntecedenciaInput] = useState("2");
  const [percentualDivisaoInput, setPercentualDivisaoInput] = useState("50");
  const [senhaExclusao, setSenhaExclusao] = useState("");
  const [confirmacaoExclusao, setConfirmacaoExclusao] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configuracoesQuery.data) {
      return;
    }

    setNotificationConfig(configuracoesQuery.data);
    setDiasAntecedenciaInput(
      String(configuracoesQuery.data.diasAntecedenciaVencimento),
    );
    setPercentualDivisaoInput(
      formatarPercentualInput(configuracoesQuery.data.percentualPadraoDivisao),
    );
  }, [configuracoesQuery.data]);

  const salvarNotificacoesMutation = useMutation({
    mutationFn: notificationService.atualizarConfiguracoes,
    onSuccess: (nextConfig) => {
      queryClient.setQueryData(queryKeys.configuracoesNotificacao, nextConfig);
      setNotificationConfig(nextConfig);
      setDiasAntecedenciaInput(String(nextConfig.diasAntecedenciaVencimento));
      setPercentualDivisaoInput(
        formatarPercentualInput(nextConfig.percentualPadraoDivisao),
      );
      setMessage("Configurações de notificações atualizadas.");
    },
    onError: (requestError) => {
      setError(
        requestError instanceof Error
          ? requestError.message
          : extractMessage(
              requestError,
              "Não foi possível salvar as configurações de notificações.",
            ),
      );
    },
  });

  function handleSelectPalette(paletteId: AppPaletteId) {
    setSelectedPalette(paletteId);
    applyPalette(paletteId);
    setMessage("Combinação de cores atualizada.");
    setError(null);
  }

  async function handleSalvarNotificacoes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (salvarNotificacoesMutation.isPending) {
      return;
    }

    setMessage(null);
    setError(null);

    try {
      const diasAntecedencia = Number(diasAntecedenciaInput);
      const percentualDivisao = parsePercentual(percentualDivisaoInput);

      if (
        diasAntecedenciaInput === "" ||
        !Number.isFinite(diasAntecedencia) ||
        diasAntecedencia < 0 ||
        diasAntecedencia > 30
      ) {
        throw new Error("Informe os dias de antecedência entre 0 e 30.");
      }

      if (
        percentualDivisaoInput === "" ||
        !Number.isFinite(percentualDivisao) ||
        percentualDivisao < 0.01 ||
        percentualDivisao > 100
      ) {
        throw new Error("Informe o percentual padrão entre 0,01% e 100%.");
      }

      salvarNotificacoesMutation.mutate({
        ...notificationConfig,
        diasAntecedenciaVencimento: diasAntecedencia,
        percentualPadraoDivisao: percentualDivisao,
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : extractMessage(
              requestError,
              "Não foi possível salvar as configurações de notificações.",
            ),
      );
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
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200" role="status">
            {message}
          </div>
        )}
        {(error || configuracoesQuery.isError) && (
          <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200 sm:flex-row sm:items-center sm:justify-between" role="alert">
            <span>{error ?? "Não foi possível carregar as configurações de notificações."}</span>
            {configuracoesQuery.isError && (
              <button
                className="rounded-xl bg-red-100 px-3 py-2 font-bold text-red-700 dark:bg-red-900/50 dark:text-red-100"
                type="button"
                onClick={() => configuracoesQuery.refetch()}
              >
                Tentar novamente
              </button>
            )}
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
              disabled={configuracoesQuery.isLoading}
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
              disabled={configuracoesQuery.isLoading || !notificationConfig.receberNotificacoes}
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
              disabled={configuracoesQuery.isLoading || !notificationConfig.receberNotificacoes}
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
                configuracoesQuery.isLoading || !notificationConfig.receberNotificacoes
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
                disabled={configuracoesQuery.isLoading || !notificationConfig.receberNotificacoes}
                min={0}
                max={30}
                value={diasAntecedenciaInput}
                onChange={(event) => setDiasAntecedenciaInput(event.target.value)}
                required
              />
            </label>
          </div>
          <div className="mt-8 border-t border-[color:var(--app-card-border)] pt-6 dark:border-slate-800">
            <h4 className="font-semibold text-slate-900 dark:text-white">
              Divisão de despesas
            </h4>
            <label className="mt-4 block max-w-xs">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Percentual padrão de divisão
              </span>
              <div className="relative mt-1">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-10 text-sm text-slate-900 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  type="text"
                  inputMode="decimal"
                  value={percentualDivisaoInput}
                  onChange={(event) =>
                    setPercentualDivisaoInput(
                      limitarPercentual(event.target.value),
                    )
                  }
                  required
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500">
                  %
                </span>
              </div>
            </label>
          </div>
          <div className="mt-5 flex justify-end">
            <button
              className="rounded-xl bg-[var(--app-accent)] px-6 py-2.5 font-medium text-[var(--app-accent-contrast)] shadow-sm disabled:opacity-60 dark:bg-white dark:text-slate-950"
              disabled={salvarNotificacoesMutation.isPending || configuracoesQuery.isLoading}
              type="submit"
            >
              {salvarNotificacoesMutation.isPending ? "Salvando..." : "Salvar configurações"}
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

function limitarPercentual(valorDigitado: string) {
  const valorNormalizado = valorDigitado
    .replace(".", ",")
    .replace(/[^\d,]/g, "");

  if (valorNormalizado === "") {
    return "";
  }

  const partes = valorNormalizado.split(",");
  const parteInteira = partes[0].replace(/^0+(?=\d)/, "");
  const parteDecimal = partes.slice(1).join("").slice(0, 2);
  const possuiSeparador = valorNormalizado.includes(",");
  const valorFormatado = possuiSeparador
    ? `${parteInteira || "0"},${parteDecimal}`
    : parteInteira || "0";

  return parsePercentual(valorFormatado) > 100 ? "100" : valorFormatado;
}

function parsePercentual(value: string) {
  const percentual = Number(value.replace(",", "."));
  return Number.isFinite(percentual) ? percentual : 0;
}

function formatarPercentualInput(value: number) {
  return String(value).replace(".", ",");
}


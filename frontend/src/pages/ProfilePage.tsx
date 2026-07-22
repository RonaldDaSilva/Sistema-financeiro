import { FormEvent, type InputHTMLAttributes, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "../components/AppLayout";
import { useConfirmDialog } from "../components/ConfirmDialog";
import { useAuth } from "../contexts/useAuth";
import { queryKeys } from "../hooks/queries/queryKeys";
import { usePerfilUsuario } from "../hooks/queries/useFinanceQueries";
import * as userService from "../services/userService";
import { maskCpf } from "../utils/cpf";

export function ProfilePage() {
  const { updateUser } = useAuth();
  const queryClient = useQueryClient();
  const { confirm, dialog } = useConfirmDialog();
  const perfilQuery = usePerfilUsuario();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!perfilQuery.data) {
      return;
    }

    setNome(perfilQuery.data.nome);
    setEmail(perfilQuery.data.email);
    setTelefone(perfilQuery.data.telefone ?? "");
    setCpf(maskCpf(perfilQuery.data.cpf ?? ""));
    updateUser(perfilQuery.data);
  }, [perfilQuery.data, updateUser]);

  const atualizarPerfilMutation = useMutation({
    mutationFn: userService.atualizarPerfil,
    onSuccess: (perfil) => {
      queryClient.setQueryData(queryKeys.perfilUsuario, perfil);
      updateUser(perfil);
      setMessage("Dados atualizados com sucesso.");
    },
    onError: (requestError) => {
      setError(extractMessage(requestError, "Não foi possível atualizar seus dados."));
    },
  });

  const alterarSenhaMutation = useMutation({
    mutationFn: userService.alterarSenha,
    onSuccess: () => {
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarNovaSenha("");
      setMessage("Senha alterada com sucesso.");
    },
    onError: (requestError) => {
      setError(extractMessage(requestError, "Não foi possível alterar sua senha."));
    },
  });

  async function handleSalvarPerfil(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (atualizarPerfilMutation.isPending) {
      return;
    }

    setMessage(null);
    setError(null);

    if (!nome.trim() || !email.trim()) {
      setError("Informe nome e e-mail.");
      return;
    }

    const confirmed = await confirm({
      title: "Salvar alterações",
      message: "Salvar as alterações dos seus dados cadastrais?",
      confirmLabel: "Salvar",
    });

    if (!confirmed) {
      return;
    }

    atualizarPerfilMutation.mutate({
      nome: nome.trim(),
      email: email.trim(),
      telefone: telefone || null,
      cpf: cpf || null,
      confirmarAlteracao: true,
    });
  }

  async function handleAlterarSenha(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (alterarSenhaMutation.isPending) {
      return;
    }

    setMessage(null);
    setError(null);

    if (novaSenha !== confirmarNovaSenha) {
      setError("A confirmação da nova senha não confere.");
      return;
    }

    if (novaSenha.length < 8) {
      setError("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }

    const confirmed = await confirm({
      title: "Alterar senha",
      message: "Alterar sua senha agora? Você usará a nova senha no próximo acesso.",
      confirmLabel: "Alterar senha",
    });

    if (!confirmed) {
      return;
    }

    alterarSenhaMutation.mutate({
      senhaAtual,
      novaSenha,
      confirmarAlteracao: true,
    });
  }

  const isLoading = perfilQuery.isLoading;

  return (
    <AppLayout>
      <section className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Conta
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Perfil do usuário
          </h2>
        </div>

        {message && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200" role="status">
            {message}
          </div>
        )}
        {(error || perfilQuery.isError) && (
          <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200 sm:flex-row sm:items-center sm:justify-between" role="alert">
            <span>{error ?? "Não foi possível carregar seus dados."}</span>
            {perfilQuery.isError && (
              <button
                className="rounded-xl bg-red-100 px-3 py-2 font-bold text-red-700 dark:bg-red-900/50 dark:text-red-100"
                type="button"
                onClick={() => perfilQuery.refetch()}
              >
                Tentar novamente
              </button>
            )}
          </div>
        )}

        <form
          className="rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          onSubmit={handleSalvarPerfil}
        >
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Dados cadastrais
          </h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <TextInput label="Nome" value={nome} onChange={setNome} disabled={isLoading} required />
            <TextInput
              label="E-mail"
              value={email}
              onChange={setEmail}
              disabled={isLoading}
              required
              type="email"
            />
            <TextInput
              label="Telefone"
              value={telefone}
              onChange={setTelefone}
              disabled={isLoading}
            />
            <TextInput
              label="CPF"
              value={cpf}
              onChange={(value) => setCpf(maskCpf(value))}
              disabled={isLoading}
              inputMode="numeric"
              placeholder="000.000.000-00"
            />
          </div>
          <div className="mt-5 flex justify-end">
            <button
              className="rounded-xl bg-[var(--app-accent)] px-6 py-2.5 font-medium text-[var(--app-accent-contrast)] shadow-sm disabled:opacity-60 dark:bg-white dark:text-slate-950"
              disabled={atualizarPerfilMutation.isPending || isLoading}
              type="submit"
            >
              {atualizarPerfilMutation.isPending ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form>

        <form
          className="rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          onSubmit={handleAlterarSenha}
        >
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Alteração de senha
          </h3>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <TextInput label="Senha atual" value={senhaAtual} onChange={setSenhaAtual} type="password" required />
            <TextInput label="Nova senha" value={novaSenha} onChange={setNovaSenha} type="password" required />
            <TextInput
              label="Confirmar nova senha"
              value={confirmarNovaSenha}
              onChange={setConfirmarNovaSenha}
              type="password"
              required
            />
          </div>
          <div className="mt-5 flex justify-end">
            <button
              className="rounded-xl border-2 border-red-100 bg-white px-6 py-2.5 font-bold text-red-600 shadow-sm disabled:opacity-60 dark:border-red-900 dark:bg-slate-900 dark:text-red-300"
              disabled={alterarSenhaMutation.isPending}
              type="submit"
            >
              {alterarSenhaMutation.isPending ? "Alterando..." : "Alterar senha"}
            </button>
          </div>
        </form>
      </section>
      {dialog}
    </AppLayout>
  );
}

type TextInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  placeholder?: string;
};

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  disabled,
  required,
  className = "",
  inputMode,
  placeholder,
}: TextInputProps) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </span>
      <input
        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        disabled={disabled}
        inputMode={inputMode}
        placeholder={placeholder}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
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


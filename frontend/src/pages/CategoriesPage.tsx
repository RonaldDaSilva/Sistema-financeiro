import { FormEvent, Suspense, lazy, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { EmojiClickData } from "emoji-picker-react";
import { Folder, Pencil, Plus, Trash2 } from "lucide-react";
import { AppLayout } from "../components/AppLayout";
import { useConfirmDialog } from "../components/ConfirmDialog";
import { useCategorias } from "../hooks/queries/useFinanceQueries";
import { queryKeys } from "../hooks/queries/queryKeys";
import * as financeService from "../services/financeService";
import type { Categoria } from "../types/finance";

const EmojiPicker = lazy(() => import("emoji-picker-react"));

type CategoryForm = {
  nome: string;
};

const emptyForm: CategoryForm = {
  nome: "",
};

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const { confirm, dialog } = useConfirmDialog();
  const categoriasQuery = useCategorias();
  const categorias = categoriasQuery.data ?? [];
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  const salvarCategoriaMutation = useMutation({
    mutationFn: (request: CategoryForm & { id?: string }) =>
      request.id
        ? financeService.atualizarCategoria(request.id, { nome: request.nome })
        : financeService.criarCategoria({ nome: request.nome }),
    onSuccess: async () => {
      setForm(emptyForm);
      setEditingId(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.categorias });
    },
    onError: () => {
      setErro("Não foi possível salvar a categoria.");
    },
  });

  const excluirCategoriaMutation = useMutation({
    mutationFn: financeService.excluirCategoria,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.categorias });
    },
    onError: () => {
      setErro("Não foi possível excluir a categoria.");
    },
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (salvarCategoriaMutation.isPending) {
      return;
    }

    setErro(null);
    const nome = form.nome.trim();

    if (!nome) {
      setErro("Informe o nome da categoria.");
      return;
    }

    salvarCategoriaMutation.mutate({ id: editingId ?? undefined, nome });
  }

  function editar(categoria: Categoria) {
    setEditingId(categoria.id);
    setForm({ nome: categoria.nome });
  }

  function handleEmojiClick(emoji: EmojiClickData) {
    setForm((current) => ({ nome: `${current.nome}${emoji.emoji}` }));
    setIsEmojiPickerOpen(false);
  }

  async function excluir(categoria: Categoria) {
    if (categoria.isDefault) {
      setErro("Categorias padrão não podem ser excluídas.");
      return;
    }

    const confirmed = await confirm({
      title: "Excluir categoria",
      message: `Excluir a categoria "${categoria.nome}"? Esta ação não remove lançamentos já cadastrados.`,
      confirmLabel: "Excluir",
      variant: "danger",
    });

    if (!confirmed) {
      return;
    }

    setErro(null);
    excluirCategoriaMutation.mutate(categoria.id);
  }

  return (
    <AppLayout>
      <section className="mx-auto grid max-w-[1400px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[360px_1fr] lg:px-8">
        <form
          className="rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-24 lg:self-start"
          onSubmit={handleSubmit}
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[var(--app-card-muted)] p-2 text-[var(--app-accent)]">
              {editingId ? <Pencil size={20} /> : <Plus size={20} />}
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {editingId ? "Editar categoria" : "Nova categoria"}
            </h2>
          </div>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Nome</span>
              <div className="relative mt-1">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-12 text-sm text-slate-900 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  value={form.nome}
                  onChange={(event) => setForm({ nome: event.target.value })}
                  disabled={salvarCategoriaMutation.isPending}
                  required
                />
                <button
                  aria-label="Selecionar emoji"
                  className="absolute right-1 top-1 rounded-lg px-2 py-1 text-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                  type="button"
                  onClick={() => setIsEmojiPickerOpen((current) => !current)}
                >
                  ☺
                </button>
                {isEmojiPickerOpen && (
                  <div className="absolute right-0 z-20 mt-2">
                    <Suspense
                      fallback={
                        <div className="w-80 rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-4 text-sm text-slate-500 shadow-xl">
                          Carregando emojis...
                        </div>
                      }
                    >
                      <EmojiPicker
                        height={420}
                        lazyLoadEmojis
                        onEmojiClick={handleEmojiClick}
                        previewConfig={{ showPreview: false }}
                        width={320}
                      />
                    </Suspense>
                  </div>
                )}
              </div>
            </label>
          </div>
          <div className="mt-5 flex gap-3">
            <button
              className="rounded-lg bg-[var(--app-accent)] px-4 py-2 font-medium text-[var(--app-accent-contrast)] shadow-sm transition-colors hover:opacity-90 dark:bg-white dark:text-slate-950"
              type="submit"
              disabled={salvarCategoriaMutation.isPending}
            >
              {salvarCategoriaMutation.isPending ? "Salvando..." : "Salvar"}
            </button>
            {editingId && (
              <button
                className="rounded-xl border border-slate-300 px-4 py-2 font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
              >
                Cancelar
              </button>
            )}
          </div>
          {erro && <p className="mt-4 text-sm text-red-600 dark:text-red-300" role="alert">{erro}</p>}
        </form>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Categorias</p>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
              Listagem e edição
            </h2>
          </div>
          {categoriasQuery.isLoading ? (
            <div className="space-y-3 rounded-2xl bg-[var(--app-card)] p-6 shadow-sm dark:bg-slate-900">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-950"
                  key={index}
                />
              ))}
            </div>
          ) : categoriasQuery.isError ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200 sm:flex-row sm:items-center sm:justify-between" role="alert">
              <span>Não foi possível carregar as categorias.</span>
              <button
                className="rounded-xl bg-red-100 px-3 py-2 text-sm font-bold text-red-700 dark:bg-red-900/50 dark:text-red-100"
                type="button"
                onClick={() => categoriasQuery.refetch()}
              >
                Tentar novamente
              </button>
            </div>
          ) : categorias.length === 0 ? (
            <div className="rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] p-6 text-sm font-semibold text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              Nenhuma categoria cadastrada. Crie a primeira usando o formulário ao lado.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] shadow-sm dark:border-slate-800 dark:bg-slate-900">
              {categorias.map((categoria) => (
                <div
                  className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 transition-colors last:border-b-0 hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/40 md:flex-row md:items-center md:justify-between"
                  key={categoria.id}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${categoria.corHexa}22`, color: categoria.corHexa }}
                    >
                      <Folder size={20} />
                    </span>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {categoria.nome}
                      </p>
                      {/* <p className="text-sm text-slate-500">
                        {categoria.isDefault
                          ? "Padrao global"
                          : "Personalizada"}
                      </p> */}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-800"
                      type="button"
                      onClick={() => editar(categoria)}
                      title="Editar categoria"
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                      type="button"
                      disabled={categoria.isDefault}
                      onClick={() => excluir(categoria)}
                      aria-label={`Excluir categoria ${categoria.nome}`}
                      title="Excluir categoria"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      {dialog}
    </AppLayout>
  );
}

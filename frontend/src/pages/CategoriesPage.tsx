import { FormEvent, useCallback, useEffect, useState } from "react";
import EmojiPicker, { type EmojiClickData } from "emoji-picker-react";
import { Folder, Pencil, Plus, Trash2 } from "lucide-react";
import { AppLayout } from "../components/AppLayout";
import * as financeService from "../services/financeService";
import type { Categoria } from "../types/finance";

type CategoryForm = {
  nome: string;
};

const emptyForm: CategoryForm = {
  nome: "",
};

export function CategoriesPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  const carregar = useCallback(async () => {
    setIsLoading(true);
    setErro(null);

    try {
      setCategorias(await financeService.listarCategorias());
    } catch {
      setErro("Nao foi possivel carregar as categorias.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);

    try {
      if (editingId) {
        await financeService.atualizarCategoria(editingId, form);
      } else {
        await financeService.criarCategoria(form);
      }

      setForm(emptyForm);
      setEditingId(null);
      await carregar();
    } catch {
      setErro("Nao foi possivel salvar a categoria.");
    }
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
      setErro("Categorias padrao nao podem ser excluidas.");
      return;
    }

    try {
      await financeService.excluirCategoria(categoria.id);
      await carregar();
    } catch {
      setErro("Nao foi possivel excluir a categoria.");
    }
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
                    <EmojiPicker
                      height={420}
                      lazyLoadEmojis
                      onEmojiClick={handleEmojiClick}
                      previewConfig={{ showPreview: false }}
                      width={320}
                    />
                  </div>
                )}
              </div>
            </label>
          </div>
          <div className="mt-5 flex gap-3">
            <button
              className="rounded-lg bg-[var(--app-accent)] px-4 py-2 font-medium text-[var(--app-accent-contrast)] shadow-sm transition-colors hover:opacity-90 dark:bg-white dark:text-slate-950"
              type="submit"
            >
              Salvar
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
          {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}
        </form>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Categorias</p>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
              Listagem e edição
            </h2>
          </div>
          {isLoading ? (
            <div className="rounded-2xl bg-[var(--app-card)] p-6 text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
              Carregando categorias...
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
    </AppLayout>
  );
}

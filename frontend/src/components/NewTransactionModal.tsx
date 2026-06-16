import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { Calendar, CreditCard, FileText, Tag, X } from "lucide-react";
import type {
  CartaoCredito,
  Categoria,
  CriarCompraParceladaRequest,
  CriarTransacaoRequest,
  ExtratoMensalItem,
} from "../types/finance";
import {
  formatCurrencyInput,
  maskBrlCurrencyInput,
  parseBrlCurrency,
  toDateInputValue,
} from "../utils/date";

type NewTransactionModalProps = {
  isOpen: boolean;
  categorias: Categoria[];
  cartoes: CartaoCredito[];
  percentualPadraoDivisao: number;
  initialTransaction?: ExtratoMensalItem | null;
  onClose: () => void;
  onCreateTransacao: (request: CriarTransacaoRequest) => Promise<void>;
  onUpdateTransacao?: (
    id: string,
    request: CriarTransacaoRequest,
  ) => Promise<void>;
  onUpdateCompraParcelada?: (
    id: string,
    numeroParcela: number,
    dataOcorrencia: string,
    request: CriarCompraParceladaRequest,
  ) => Promise<void>;
  onCreateCompraParcelada: (
    request: CriarCompraParceladaRequest,
  ) => Promise<void>;
};

export function NewTransactionModal({
  isOpen,
  categorias,
  cartoes,
  percentualPadraoDivisao,
  initialTransaction,
  onClose,
  onCreateTransacao,
  onUpdateTransacao,
  onUpdateCompraParcelada,
  onCreateCompraParcelada,
}: NewTransactionModalProps) {
  const [tipo, setTipo] = useState<"receita" | "despesa" | "investimento">(
    "despesa",
  );
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [meuValor, setMeuValor] = useState("");
  const [isDividida, setIsDividida] = useState(false);
  const [percentualDivisao, setPercentualDivisao] = useState(
    String(percentualPadraoDivisao),
  );
  const [data, setData] = useState(toDateInputValue(new Date()));
  const [categoriaId, setCategoriaId] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("Pix");
  const [cartaoCreditoId, setCartaoCreditoId] = useState("");
  const [isFixa, setIsFixa] = useState(false);
  const [isParcelada, setIsParcelada] = useState(false);
  const [quantidadeParcelas, setQuantidadeParcelas] = useState(2);
  const [dataPrimeiroVencimento, setDataPrimeiroVencimento] = useState(
    toDateInputValue(new Date()),
  );
  const [erro, setErro] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRepeatPromptOpen, setIsRepeatPromptOpen] = useState(false);

  const categoriasOrdenadas = useMemo(
    () => [...categorias].sort((a, b) => a.nome.localeCompare(b.nome)),
    [categorias],
  );
  const isEditing = Boolean(initialTransaction?.id);
  const isEditingCompraParcelada =
    Boolean(initialTransaction?.compraParceladaId) &&
    (initialTransaction?.origem === "CompraParcelada" ||
      initialTransaction?.origem === "Carne");
  const isCarne = formaPagamento === "Carnê/Crediário";
  const parcelasRestantes =
    initialTransaction?.numeroParcela && initialTransaction?.quantidadeParcelas
      ? initialTransaction.quantidadeParcelas -
        initialTransaction.numeroParcela +
        1
      : quantidadeParcelas;

  useEffect(() => {
    if (isOpen && categoriasOrdenadas.length > 0 && !categoriaId) {
      setCategoriaId(categoriasOrdenadas[0].id);
    }
  }, [categoriaId, categoriasOrdenadas, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (!initialTransaction) {
      setTipo("despesa");
      setDescricao("");
      setValor("");
      setMeuValor("");
      setIsDividida(false);
      setPercentualDivisao(String(percentualPadraoDivisao));
      setData(toDateInputValue(new Date()));
      setCategoriaId(categoriasOrdenadas[0]?.id ?? "");
      setFormaPagamento("Pix");
      setCartaoCreditoId("");
      setIsFixa(false);
      setIsParcelada(false);
      setQuantidadeParcelas(2);
      setDataPrimeiroVencimento(toDateInputValue(new Date()));
      setErro(null);
      setIsRepeatPromptOpen(false);
      return;
    }

    const isReceita =
      initialTransaction.tipo === 1 || initialTransaction.tipo === "Receita";
    const isInvestimento =
      initialTransaction.tipo === 3 ||
      initialTransaction.tipo === "Investimento";

    setTipo(
      isReceita ? "receita" : isInvestimento ? "investimento" : "despesa",
    );
    setDescricao(stripProjectedInstallmentSuffix(initialTransaction.descricao));
    setIsDividida(initialTransaction.isDividida);
    setValor(
      formatCurrencyInput(
        initialTransaction.isDividida &&
          initialTransaction.valorTotalOriginal != null
          ? initialTransaction.valorTotalOriginal
          : initialTransaction.valor,
      ),
    );
    setMeuValor(
      initialTransaction.isDividida
        ? formatCurrencyInput(initialTransaction.valor)
        : "",
    );
    setPercentualDivisao(
      formatarPercentualInput(
        initialTransaction.percentualDivisao ?? percentualPadraoDivisao,
      ),
    );
    setData(initialTransaction.dataOcorrencia);
    setCategoriaId(initialTransaction.categoriaId ?? "");
    setFormaPagamento(initialTransaction.formaPagamento);
    setCartaoCreditoId(initialTransaction.cartaoCreditoId ?? "");
    setIsFixa(initialTransaction.isFixa);
    setIsParcelada(
      initialTransaction.origem === "CompraParcelada" ||
        initialTransaction.origem === "Carne",
    );
    setQuantidadeParcelas(2);
    setDataPrimeiroVencimento(initialTransaction.dataOcorrencia);
    setErro(null);
    setIsRepeatPromptOpen(false);
  }, [
    categoriasOrdenadas,
    initialTransaction,
    isOpen,
    percentualPadraoDivisao,
  ]);

  useEffect(() => {
    if (tipo !== "despesa") {
      setIsParcelada(false);
      setCartaoCreditoId("");
      setIsDividida(false);
      setMeuValor("");
    }

    if (tipo === "receita") {
      setFormaPagamento("Pix");
    } else if (
      tipo === "investimento" &&
      formaPagamento === "Cartão de crédito"
    ) {
      setFormaPagamento("Débito em conta");
    }
  }, [formaPagamento, tipo]);

  if (!isOpen) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setIsSubmitting(true);

    try {
      const numericValue = parseBrlCurrency(valor);
      const numericPercentual = parsePercentual(percentualDivisao);
      const numericMeuValor = isDividida
        ? calcularParteNumerica(numericValue, numericPercentual)
        : numericValue;

      if (
        isDividida &&
        (!numericValue ||
          !numericMeuValor ||
          !numericPercentual ||
          numericPercentual > 100 ||
          numericMeuValor > numericValue)
      ) {
        throw new Error(
          "O percentual deve estar entre 0,01% e 100%, e seu valor não pode superar o valor total.",
        );
      }

      if (tipo === "despesa" && !categoriaId) {
        throw new Error("Selecione uma categoria.");
      }

      if (isEditingCompraParcelada) {
        if (
          !initialTransaction?.compraParceladaId ||
          !initialTransaction.numeroParcela
        ) {
          throw new Error("Compra parcelada não identificada.");
        }

        if (!isCarne && !cartaoCreditoId) {
          throw new Error("Selecione um cartão para a despesa parcelada.");
        }

        if (isCarne && !dataPrimeiroVencimento) {
          throw new Error("Informe a data do 1º vencimento.");
        }

        await onUpdateCompraParcelada?.(
          initialTransaction.compraParceladaId,
          initialTransaction.numeroParcela,
          data,
          {
            cartaoCreditoId: isCarne ? null : cartaoCreditoId,
            categoriaId,
            descricao,
            quantidadeParcelas: parcelasRestantes,
            valorTotal: isDividida
              ? calcularParteNumerica(
                  numericValue * parcelasRestantes,
                  numericPercentual,
                )
              : numericMeuValor * parcelasRestantes,
            isDividida,
            valorTotalOriginal: isDividida
              ? numericValue * parcelasRestantes
              : null,
            percentualDivisao: isDividida ? numericPercentual : null,
            dataCompra: data,
            dataPrimeiroVencimento: isCarne ? dataPrimeiroVencimento : null,
            formaPagamento: isCarne ? 2 : 1,
          },
        );
      } else if (!isEditing && tipo === "despesa" && isParcelada) {
        if (!isCarne && !cartaoCreditoId) {
          throw new Error("Selecione um cartão para a despesa parcelada.");
        }

        if (isCarne && !dataPrimeiroVencimento) {
          throw new Error("Informe a data do 1º vencimento.");
        }

        await onCreateCompraParcelada({
          cartaoCreditoId: isCarne ? null : cartaoCreditoId,
          categoriaId,
          descricao,
          quantidadeParcelas,
          valorTotal: numericMeuValor,
          isDividida,
          valorTotalOriginal: isDividida ? numericValue : null,
          percentualDivisao: isDividida ? numericPercentual : null,
          dataCompra: data,
          dataPrimeiroVencimento: isCarne ? dataPrimeiroVencimento : null,
          formaPagamento: isCarne ? 2 : 1,
        });
      } else {
        const request: CriarTransacaoRequest = {
          tipo: tipo === "receita" ? 1 : tipo === "despesa" ? 2 : 3,
          descricao,
          valor: numericMeuValor,
          dataOcorrencia: data,
          categoriaId: tipo === "despesa" ? categoriaId : null,
          formaPagamento,
          cartaoCreditoId: tipo === "despesa" ? cartaoCreditoId || null : null,
          isFixa,
          isDividida,
          valorTotalOriginal: isDividida ? numericValue : null,
          percentualDivisao: isDividida ? numericPercentual : null,
          compraParceladaId: initialTransaction?.compraParceladaId ?? null,
          numeroParcelaQuitada: initialTransaction?.numeroParcela ?? null,
        };

        if (isEditing && initialTransaction?.id && onUpdateTransacao) {
          await onUpdateTransacao(initialTransaction.id, request);
        } else {
          await onCreateTransacao(request);
        }
      }

      if (isEditing || isEditingCompraParcelada) {
        onClose();
        resetFormToDefault();
      } else {
        setIsRepeatPromptOpen(true);
      }
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a transação.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
      <form
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-[var(--app-card)] shadow-2xl dark:bg-slate-900"
        onSubmit={handleSubmit}
      >
        <div className="flex items-start justify-between border-b border-[color:var(--app-card-border)] bg-slate-50/50 px-6 py-5 dark:border-slate-800 dark:bg-slate-950/50">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {isEditing ? "Editar transação" : "Adicionar nova transação"}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Adicione os detalhes da movimentação.
            </p>
          </div>
          <button
            className="rounded-full bg-white p-2 text-slate-400 shadow-sm transition-colors hover:bg-slate-100 hover:text-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-grow space-y-6 overflow-y-auto px-6 py-6">
          <div className="flex rounded-xl bg-slate-100/80 p-1.5 shadow-inner dark:bg-slate-800">
            <TypeButton
              active={tipo === "despesa"}
              tone="danger"
              label="Despesa"
              onClick={() => setTipo("despesa")}
            />
            <TypeButton
              active={tipo === "receita"}
              tone="success"
              label="Receita"
              onClick={() => setTipo("receita")}
            />
            <TypeButton
              active={tipo === "investimento"}
              tone="investment"
              label="Investimento"
              onClick={() => setTipo("investimento")}
            />
          </div>

          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
                {isDividida
                  ? isEditingCompraParcelada
                    ? "Valor Total da Parcela"
                    : "Valor Total da Compra"
                  : isEditingCompraParcelada
                  ? "Valor da parcela"
                  : isParcelada
                    ? "Valor total"
                    : "Valor"}
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span
                    className={`font-sans font-medium ${
                      tipo === "receita"
                        ? "text-emerald-400"
                        : tipo === "investimento"
                          ? "text-indigo-400"
                          : "text-red-400"
                    }`}
                  >
                    R$
                  </span>
                </div>
                <input
                  className={`w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-2xl font-black outline-none transition-all focus:bg-white focus:ring-2 dark:border-slate-700 dark:bg-slate-950 ${
                    tipo === "receita"
                      ? "text-emerald-600 focus:ring-emerald-500"
                      : tipo === "investimento"
                        ? "text-indigo-600 focus:ring-indigo-500"
                        : "text-red-600 focus:ring-red-500"
                  }`}
                  inputMode="numeric"
                  placeholder="0,00"
                  value={valor}
                  onChange={(event) => {
                    const nextValue = maskBrlCurrencyInput(event.target.value);
                    setValor(nextValue);
                    if (isDividida) {
                      setMeuValor(
                        calcularMeuValor(nextValue, percentualDivisao),
                      );
                    }
                  }}
                  required
                />
              </div>
            </div>

            <IconField label="Descrição" icon={<FileText size={18} />}>
              <input
                className={inputClass}
                value={descricao}
                onChange={(event) => setDescricao(event.target.value)}
                maxLength={180}
                placeholder="Ex: Almoço restaurante"
                required
              />
            </IconField>

            <div className="flex flex-col gap-4 sm:flex-row">
              <IconField label="Data" icon={<Calendar size={18} />}>
                <input
                  className={inputClass}
                  type="date"
                  value={data}
                  onChange={(event) => setData(event.target.value)}
                  required
                />
              </IconField>

              {tipo === "despesa" && (
                <IconField label="Categoria" icon={<Tag size={18} />}>
                  <select
                    className={`${inputClass} appearance-none`}
                    value={categoriaId}
                    onChange={(event) => setCategoriaId(event.target.value)}
                    required
                  >
                    {categoriasOrdenadas.map((categoria) => (
                      <option key={categoria.id} value={categoria.id}>
                        {categoria.nome}
                      </option>
                    ))}
                  </select>
                </IconField>
              )}
            </div>
          </div>

          {tipo === "despesa" && (
            <div className="flex flex-col gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:flex-wrap sm:gap-8">
              {!isEditing && !isEditingCompraParcelada && (
                <>
                  <ToggleField
                    checked={isFixa}
                    disabled={isParcelada}
                    label="Despesa fixa"
                    onChange={(checked) => setIsFixa(checked)}
                  />
                  <ToggleField
                    checked={isParcelada}
                    disabled={isFixa}
                    label="Parcelada"
                    onChange={(checked) => {
                      setIsParcelada(checked);
                      if (checked) {
                        setFormaPagamento("Cartão de crédito");
                      } else {
                        setCartaoCreditoId("");
                      }
                    }}
                  />
                </>
              )}
              <ToggleField
                checked={isDividida}
                label="Dividir despesa"
                onChange={(checked) => {
                  setIsDividida(checked);
                  if (checked) {
                    const nextPercentual = String(percentualPadraoDivisao);
                    setPercentualDivisao(nextPercentual);
                    setMeuValor(calcularMeuValor(valor, nextPercentual));
                  } else {
                    setMeuValor("");
                  }
                }}
              />
            </div>
          )}

          {tipo === "despesa" && isDividida && (
            <div className="grid gap-4 rounded-xl border border-[color:var(--app-card-border)] bg-[var(--app-card-muted)] p-4 dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Percentual
                </span>
                <div className="relative">
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-9 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    type="text"
                    inputMode="decimal"
                    value={percentualDivisao}
                    onChange={(event) => {
                      const nextPercentual = limitarPercentual(
                        event.target.value,
                      );
                      setPercentualDivisao(nextPercentual);
                      setMeuValor(calcularMeuValor(valor, nextPercentual));
                    }}
                    required
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500">
                    %
                  </span>
                </div>
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Meu Valor
                </span>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-500">
                    R$
                  </span>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    inputMode="numeric"
                    value={meuValor}
                    onChange={(event) => {
                      const nextMeuValor = limitarMeuValor(
                        valor,
                        event.target.value,
                      );
                      setMeuValor(nextMeuValor);
                      setPercentualDivisao(
                        calcularPercentual(valor, nextMeuValor),
                      );
                    }}
                    required
                  />
                </div>
              </label>
            </div>
          )}

          {isEditingCompraParcelada && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              Esta alteração será aplicada da parcela{" "}
              {initialTransaction?.numeroParcela} em diante.
            </div>
          )}

          {tipo === "receita" && (
            <div className="py-1">
              <ToggleField
                checked={isFixa}
                label="Receita fixa"
                onChange={(checked) => setIsFixa(checked)}
              />
            </div>
          )}

          {tipo === "investimento" && (
            <div className="py-1">
              <ToggleField
                checked={isFixa}
                label="Investimento fixo"
                onChange={(checked) => setIsFixa(checked)}
              />
            </div>
          )}

          {!isParcelada && (
            <IconField
              label="Forma de pagamento"
              icon={<CreditCard size={16} />}
            >
              <select
                className={`${inputClass} appearance-none`}
                value={formaPagamento}
                onChange={(event) => {
                  setFormaPagamento(event.target.value);
                  if (event.target.value === "Carnê/Crediário") {
                    setIsParcelada(true);
                    setIsFixa(false);
                    setCartaoCreditoId("");
                  }
                }}
              >
                <option>Pix</option>
                <option>Dinheiro</option>
                <option>Débito</option>
                {tipo !== "receita" && <option>Débito em conta</option>}
                {tipo === "despesa" && <option>Cartão de crédito</option>}
                {tipo === "despesa" && <option>Carnê/Crediário</option>}
                <option>Transferência</option>
              </select>
            </IconField>
          )}

          {tipo === "despesa" &&
            isParcelada &&
            !isEditing &&
            !isEditingCompraParcelada && (
              <IconField
                label="Forma do parcelamento"
                icon={<CreditCard size={16} />}
              >
                <select
                  className={`${inputClass} appearance-none`}
                  value={formaPagamento}
                  onChange={(event) => {
                    setFormaPagamento(event.target.value);
                    if (event.target.value === "Carnê/Crediário") {
                      setCartaoCreditoId("");
                    }
                  }}
                >
                  <option>Cartão de crédito</option>
                  <option>Carnê/Crediário</option>
                </select>
              </IconField>
            )}

          {(formaPagamento === "Cartão de crédito" ||
            (isParcelada && !isCarne)) &&
            tipo === "despesa" && (
              <IconField label="Cartão" icon={<CreditCard size={16} />}>
                <select
                  className={`${inputClass} appearance-none`}
                  value={cartaoCreditoId}
                  onChange={(event) => setCartaoCreditoId(event.target.value)}
                  required={isParcelada}
                >
                  <option value="">Selecione</option>
                  {cartoes.map((cartao) => (
                    <option key={cartao.id} value={cartao.id}>
                      {cartao.apelidoCartao}
                    </option>
                  ))}
                </select>
              </IconField>
            )}

          {tipo === "despesa" &&
            isParcelada &&
            !isEditing &&
            !isEditingCompraParcelada && (
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Parcelas
                </span>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  type="number"
                  min={2}
                  max={120}
                  value={quantidadeParcelas || ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setQuantidadeParcelas(value === "" ? 0 : Number(value));
                  }}
                  required
                />
              </label>
            )}

          {tipo === "despesa" &&
            isParcelada &&
            isCarne &&
            !isEditingCompraParcelada && (
              <IconField
                label="Data do 1º vencimento"
                icon={<Calendar size={16} />}
              >
                <input
                  className={inputClass}
                  type="date"
                  value={dataPrimeiroVencimento}
                  onChange={(event) =>
                    setDataPrimeiroVencimento(event.target.value)
                  }
                  required
                />
              </IconField>
            )}
        </div>

        {erro && <p className="px-6 pb-2 text-sm text-red-600">{erro}</p>}

        <div className="flex justify-end gap-3 border-t border-[color:var(--app-card-border)] bg-slate-50/80 px-6 py-5 dark:border-slate-800 dark:bg-slate-950">
          <button
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            type="button"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="rounded-xl bg-[var(--app-accent)] px-6 py-2.5 text-sm font-bold text-[var(--app-accent-contrast)] shadow-sm transition-colors hover:opacity-90 disabled:opacity-60 dark:bg-white dark:text-slate-950"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Salvando..."
              : isEditing
                ? "Atualizar"
                : "Salvar transação"}
          </button>
        </div>
      </form>

      {isRepeatPromptOpen && (
        <div className="absolute inset-0 z-[80] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-[color:var(--app-card-border)] bg-slate-50/60 px-6 py-5 dark:border-slate-800 dark:bg-slate-950/50">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Adicionar outra transação?
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                A transação foi salva. Deseja manter esta janela aberta para cadastrar uma nova movimentação?
              </p>
            </div>
            <div className="flex flex-col-reverse gap-3 px-6 py-5 sm:flex-row sm:justify-end">
              <button
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                type="button"
                onClick={() => {
                  setIsRepeatPromptOpen(false);
                  resetFormToDefault();
                  onClose();
                }}
              >
                Não, fechar
              </button>
              <button
                className="rounded-xl bg-[var(--app-accent)] px-5 py-2.5 text-sm font-bold text-[var(--app-accent-contrast)] shadow-sm transition-colors hover:opacity-90 dark:bg-white dark:text-slate-950"
                type="button"
                onClick={() => {
                  setIsRepeatPromptOpen(false);
                  resetFormToDefault();
                }}
              >
                Sim, adicionar outra
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function resetFormToDefault() {
    setTipo("despesa");
    setDescricao("");
    setValor("");
    setMeuValor("");
    setIsDividida(false);
    setPercentualDivisao(String(percentualPadraoDivisao));
    setData(toDateInputValue(new Date()));
    setCategoriaId(categoriasOrdenadas[0]?.id ?? "");
    setFormaPagamento("Pix");
    setCartaoCreditoId("");
    setIsFixa(false);
    setIsParcelada(false);
    setQuantidadeParcelas(2);
    setDataPrimeiroVencimento(toDateInputValue(new Date()));
    setErro(null);
  }
}

function calcularMeuValor(valorTotal: string, percentual: string) {
  const total = parseBrlCurrency(valorTotal);
  const percentualNumerico = parsePercentual(percentual);

  if (!total || !percentualNumerico) {
    return "";
  }

  return formatCurrencyInput(calcularParteNumerica(total, percentualNumerico));
}

function calcularPercentual(valorTotal: string, meuValor: string) {
  const total = parseBrlCurrency(valorTotal);
  const parte = parseBrlCurrency(meuValor);

  if (!total || !parte) {
    return "";
  }

  return formatarPercentualInput(
    Math.min(100, Math.round((parte / total) * 10000) / 100),
  );
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
  const percentual = parsePercentual(valorFormatado);

  if (percentual > 100) {
    return "100";
  }

  return valorFormatado;
}

function limitarMeuValor(valorTotal: string, valorDigitado: string) {
  const valorMascarado = maskBrlCurrencyInput(valorDigitado);
  const total = parseBrlCurrency(valorTotal);
  const parte = parseBrlCurrency(valorMascarado);

  if (total > 0 && parte > total) {
    return formatCurrencyInput(total);
  }

  return valorMascarado;
}

function calcularParteNumerica(valorTotal: number, percentual: number) {
  return (
    Math.round(
      (valorTotal * (percentual / 100) + Number.EPSILON) * 100,
    ) / 100
  );
}

function parsePercentual(value: string) {
  const percentual = Number(value.replace(",", "."));
  return Number.isFinite(percentual) ? percentual : 0;
}

function formatarPercentualInput(value: number) {
  return String(value).replace(".", ",");
}

function stripProjectedInstallmentSuffix(descricao: string) {
  return descricao.replace(/\s+\(\d+\/\d+\)\s+\[Carnê\]$/u, "");
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

function TypeButton({
  active,
  tone,
  label,
  onClick,
}: {
  active: boolean;
  tone: "danger" | "success" | "investment";
  label: string;
  onClick: () => void;
}) {
  const activeClass =
    tone === "success"
      ? "bg-white text-emerald-600 shadow-sm dark:bg-slate-950"
      : tone === "investment"
        ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-950"
        : "bg-white text-red-600 shadow-sm dark:bg-slate-950";

  return (
    <button
      className={`flex-1 rounded-md py-2 text-sm font-semibold transition-all ${
        active
          ? activeClass
          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      }`}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function IconField({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block flex-1 space-y-1.5">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </span>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
          {icon}
        </div>
        {children}
      </div>
    </label>
  );
}

function ToggleField({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`group flex cursor-pointer items-center gap-3 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <span
        className={`relative h-5 w-10 rounded-full transition-colors ${
          checked
            ? "bg-[var(--app-accent)] dark:bg-white"
            : "bg-slate-200 dark:bg-slate-700"
        }`}
      >
        <span
          className={`absolute left-1 top-1 h-3 w-3 rounded-full bg-white transition-transform dark:bg-slate-950 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
      <input
        checked={checked}
        className="sr-only"
        disabled={disabled}
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 dark:text-slate-300 dark:group-hover:text-white">
        {label}
      </span>
    </label>
  );
}

import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, CreditCard, FileText, Landmark, Search, Tag, Users } from "lucide-react";
import { InfoTooltip } from "./InfoTooltip";
import * as financeService from "../services/financeService";
import { queryKeys } from "../hooks/queries/queryKeys";
import type {
  CartaoCredito,
  CartaoCreditoOpcao,
  Categoria,
  ContaBancaria,
  CriarCompraParceladaRequest,
  CriarTransacaoRequest,
  ExtratoMensalItem,
  ReembolsoDivisao,
  ResolverConvidadoDivisaoResponse,
} from "../types/finance";
import {
  formatCurrencyInput,
  maskBrlCurrencyInput,
  parseBrlCurrency,
  toDateInputValue,
} from "../utils/date";

export type TransactionFormProps = {
  variant: "modal" | "page";
  categorias: Categoria[];
  cartoes: Array<CartaoCredito | CartaoCreditoOpcao>;
  contas: ContaBancaria[];
  percentualPadraoDivisao: number;
  initialTransaction?: ExtratoMensalItem | null;
  onCancel: () => void;
  onSaved?: (summary: TransactionFormSavedSummary) => void;
  onCartaoNecessarioChange?: (necessario: boolean) => void;
  onCreateTransacao: (
    request: CriarTransacaoRequest,
  ) => Promise<{ id: string } | void>;
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

export type TransactionFormSavedSummary = {
  tipo: "receita" | "despesa" | "investimento";
  descricao: string;
  data: string;
  valor: number;
  isParcelada: boolean;
};

export function TransactionForm({
  variant,
  categorias,
  cartoes,
  contas,
  percentualPadraoDivisao,
  initialTransaction,
  onCancel,
  onSaved,
  onCartaoNecessarioChange,
  onCreateTransacao,
  onUpdateTransacao,
  onUpdateCompraParcelada,
  onCreateCompraParcelada,
}: TransactionFormProps) {
  const [tipo, setTipo] = useState<"receita" | "despesa" | "investimento">(
    "despesa",
  );
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [meuValor, setMeuValor] = useState("");
  const [isDividida, setIsDividida] = useState(false);
  const [modoDivisao, setModoDivisao] = useState<"manual" | "vinculada">(
    "manual",
  );
  const [percentualDivisao, setPercentualDivisao] = useState(
    String(percentualPadraoDivisao),
  );
  const [emailConvidado, setEmailConvidado] = useState("");
  const [convidadoResolvido, setConvidadoResolvido] =
    useState<ResolverConvidadoDivisaoResponse | null>(null);
  const [salvarContato, setSalvarContato] = useState(true);
  const [apelidoContato, setApelidoContato] = useState("");
  const [temParteExterna, setTemParteExterna] = useState(false);
  const [percentualParteExterna, setPercentualParteExterna] = useState("0");
  const [vincularReembolso, setVincularReembolso] = useState(false);
  const [reembolsoDivisaoId, setReembolsoDivisaoId] = useState("");
  const [data, setData] = useState(toDateInputValue(new Date()));
  const [categoriaId, setCategoriaId] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("Pix");
  const [cartaoCreditoId, setCartaoCreditoId] = useState("");
  const [contaBancariaId, setContaBancariaId] = useState("");
  const [isFixa, setIsFixa] = useState(false);
  const [isParcelada, setIsParcelada] = useState(false);
  const [quantidadeParcelas, setQuantidadeParcelas] = useState(2);
  const [dataPrimeiroVencimento, setDataPrimeiroVencimento] = useState(
    toDateInputValue(new Date()),
  );
  const [erro, setErro] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRepeatPromptOpen, setIsRepeatPromptOpen] = useState(false);
  const queryClient = useQueryClient();

  const contatosDivisaoQuery = useQuery({
    queryKey: queryKeys.contatosDivisao,
    queryFn: ({ signal }) => financeService.listarContatosDivisao(signal),
    enabled: tipo === "despesa" && isDividida && modoDivisao === "vinculada",
    staleTime: 5 * 60 * 1000,
  });
  const reembolsosPendentesQuery = useQuery({
    queryKey: queryKeys.reembolsosDivisaoPendentes,
    queryFn: ({ signal }) => financeService.listarReembolsosPendentes(signal),
    enabled: tipo === "receita",
    staleTime: 60 * 1000,
  });
  const resolverConvidadoMutation = useMutation({
    mutationFn: financeService.resolverConvidadoDivisao,
    onSuccess: (data) => setConvidadoResolvido(data),
    onError: (error) => {
      setConvidadoResolvido(null);
      setErro(extractApiError(error, "Não foi possível buscar este e-mail."));
    },
  });

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
  const percentualMinhaParte = parsePercentual(percentualDivisao);
  const percentualExterno = temParteExterna
    ? parsePercentual(percentualParteExterna)
    : 0;
  const percentualConvidado = Math.max(
    0,
    Math.round((100 - percentualMinhaParte - percentualExterno) * 100) / 100,
  );
  const numericValorTotal = parseBrlCurrency(valor);
  const valorMinhaParte = isDividida
    ? calcularParteNumerica(numericValorTotal, percentualMinhaParte)
    : numericValorTotal;
  const valorConvidado = isDividida
    ? calcularParteNumerica(numericValorTotal, percentualConvidado)
    : 0;
  const valorExterno = isDividida
    ? Math.max(0, numericValorTotal - valorMinhaParte - valorConvidado)
    : 0;
  const somaPercentualDivisao =
    Math.round((percentualMinhaParte + percentualConvidado + percentualExterno) * 100) / 100;
  const divisaoVinculadaAtiva =
    tipo === "despesa" && isDividida && modoDivisao === "vinculada";
  const descricaoConvidado =
    convidadoResolvido?.nomeExibicao || convidadoResolvido?.emailMascarado || "Convidado";

  useEffect(() => {
    if (categoriasOrdenadas.length > 0 && !categoriaId) {
      setCategoriaId(categoriasOrdenadas[0].id);
    }
  }, [categoriaId, categoriasOrdenadas]);

  useEffect(() => {
    if (!initialTransaction) {
      setTipo("despesa");
      setDescricao("");
      setValor("");
      setMeuValor("");
      setIsDividida(false);
      setModoDivisao("manual");
      setPercentualDivisao(String(percentualPadraoDivisao));
      setEmailConvidado("");
      setConvidadoResolvido(null);
      setSalvarContato(true);
      setApelidoContato("");
      setTemParteExterna(false);
      setPercentualParteExterna("0");
      setVincularReembolso(false);
      setReembolsoDivisaoId("");
      setData(toDateInputValue(new Date()));
      setCategoriaId(categoriasOrdenadas[0]?.id ?? "");
      setFormaPagamento("Pix");
      setCartaoCreditoId("");
      setContaBancariaId("");
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
    setModoDivisao("manual");
    setEmailConvidado("");
    setConvidadoResolvido(null);
    setSalvarContato(true);
    setApelidoContato("");
    setTemParteExterna(false);
    setPercentualParteExterna("0");
    setVincularReembolso(false);
    setReembolsoDivisaoId(initialTransaction.reembolsoDivisaoId ?? "");
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
    setContaBancariaId(initialTransaction.contaBancariaId ?? "");
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
    percentualPadraoDivisao,
  ]);

  useEffect(() => {
    if (tipo !== "despesa") {
      setIsParcelada(false);
      setCartaoCreditoId("");
      setIsDividida(false);
      setModoDivisao("manual");
      setMeuValor("");
    }

    if (tipo === "receita") {
      setFormaPagamento("Pix");
      setModoDivisao("manual");
      setIsDividida(false);
    } else if (tipo === "investimento") {
      setContaBancariaId("");
    }

    if (
      tipo === "investimento" &&
      formaPagamento === "Cartão de crédito"
    ) {
      setFormaPagamento("Débito em conta");
    }
  }, [formaPagamento, tipo]);

  const cartaoNecessario =
    tipo === "despesa" &&
    (formaPagamento === "Cartão de crédito" || (isParcelada && !isCarne));

  useEffect(() => {
    onCartaoNecessarioChange?.(cartaoNecessario);
  }, [cartaoNecessario, onCartaoNecessarioChange]);

  async function handleResolverConvidado() {
    setErro(null);
    const email = emailConvidado.trim();
    if (!email) {
      setErro("Informe o e-mail completo do convidado.");
      return;
    }

    await resolverConvidadoMutation.mutateAsync(email);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setIsSubmitting(true);

    try {
      const numericValue = parseBrlCurrency(valor);
      const numericPercentual = parsePercentual(percentualDivisao);
      const numericPercentualExterno = temParteExterna
        ? parsePercentual(percentualParteExterna)
        : 0;
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

      if (divisaoVinculadaAtiva) {
        if (isEditing || isEditingCompraParcelada) {
          throw new Error(
            "Para alterar uma divisão vinculada existente, use o fluxo de alteração da divisão.",
          );
        }

        if (isParcelada) {
          throw new Error(
            "O contrato atual cria convite a partir de uma transação avulsa ou fixa. Para parceladas, use a divisão manual até o backend expor o vínculo da compra parcelada.",
          );
        }

        if (!convidadoResolvido?.encontrado || !emailConvidado.trim()) {
          throw new Error("Busque e selecione uma pessoa antes de salvar a divisão vinculada.");
        }

        if (
          numericPercentual <= 0 ||
          percentualConvidado <= 0 ||
          (temParteExterna && numericPercentualExterno <= 0) ||
          somaPercentualDivisao !== 100
        ) {
          throw new Error("A soma entre você, convidado e parte externa deve fechar em 100%.");
        }
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
          contaBancariaId:
            (tipo === "despesa" || tipo === "receita") &&
            formaPagamento !== "Cartão de crédito" &&
            !isParcelada
              ? contaBancariaId || null
              : null,
          isFixa,
          isDividida,
          valorTotalOriginal: isDividida ? numericValue : null,
          percentualDivisao: isDividida ? numericPercentual : null,
          compraParceladaId: initialTransaction?.compraParceladaId ?? null,
          numeroParcelaQuitada: initialTransaction?.numeroParcela ?? null,
          reembolsoDivisaoId:
            tipo === "receita" && vincularReembolso
              ? reembolsoDivisaoId || null
              : null,
        };

        if (isEditing && initialTransaction?.id && onUpdateTransacao) {
          await onUpdateTransacao(initialTransaction.id, request);
        } else {
          const transacaoCriada = await onCreateTransacao(request);
          if (divisaoVinculadaAtiva && transacaoCriada?.id) {
            await financeService.criarConviteDivisao({
              transacaoOrigemId: transacaoCriada.id,
              participantesUsuarios: [
                {
                  email: emailConvidado.trim(),
                  percentual: percentualConvidado,
                  salvarContato,
                  apelidoContato: apelidoContato.trim() || null,
                },
              ],
              participantesExternos: temParteExterna
                ? [
                    {
                      percentual: numericPercentualExterno,
                      nome: null,
                    },
                  ]
                : [],
            });
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: queryKeys.contatosDivisao }),
              queryClient.invalidateQueries({ queryKey: queryKeys.notificacoesNaoLidas }),
            ]);
          }
          if (request.reembolsoDivisaoId) {
            await queryClient.invalidateQueries({
              queryKey: queryKeys.reembolsosDivisaoPendentes,
            });
          }
        }
      }

      if (isEditing || isEditingCompraParcelada) {
        onCancel();
        resetFormToDefault();
      } else {
        onSaved?.({
          tipo,
          descricao,
          data,
          valor: numericMeuValor,
          isParcelada,
        });
        if (variant === "modal") {
          setIsRepeatPromptOpen(true);
        }
      }
    } catch (error) {
      setErro(extractApiError(error, "Não foi possível salvar a transação."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={variant === "page" ? "contents" : "relative contents"}>
      <form
        className={
          variant === "page"
            ? "flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] shadow-xl dark:border-slate-800 dark:bg-slate-900"
            : "flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-[var(--app-card)] shadow-2xl dark:bg-slate-900"
        }
        onSubmit={handleSubmit}
      >
        {variant === "modal" && (
          <div className="relative border-b border-[color:var(--app-card-border)] bg-slate-50/50 px-6 py-5 dark:border-slate-800 dark:bg-slate-950/50">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {isEditing || isEditingCompraParcelada
                ? "Editar transação"
                : "Adicionar nova transação"}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Adicione os detalhes da movimentação.
            </p>
          </div>
        )}

        <div className="flex-grow space-y-6 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
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
                label="Dividir esta transação"
                onChange={(checked) => {
                  setIsDividida(checked);
                  if (checked) {
                    const nextPercentual = String(percentualPadraoDivisao);
                    setPercentualDivisao(nextPercentual);
                    setMeuValor(calcularMeuValor(valor, nextPercentual));
                  } else {
                    setMeuValor("");
                    setModoDivisao("manual");
                  }
                }}
              />
            </div>
          )}

          {tipo === "despesa" && isDividida && (
            <div className="space-y-4 rounded-xl border border-[color:var(--app-card-border)] bg-[var(--app-card-muted)] p-4 dark:border-slate-800 dark:bg-slate-950">
              <fieldset className="space-y-3">
                <legend className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Tipo de divisão
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  <RadioOption
                    checked={modoDivisao === "manual"}
                    label="Apenas informar minha parte"
                    onChange={() => setModoDivisao("manual")}
                  />
                  <RadioOption
                    checked={modoDivisao === "vinculada"}
                    label="Dividir com outra pessoa"
                    onChange={() => setModoDivisao("vinculada")}
                  />
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Minha parte
                  </span>
                  <div className="relative">
                    <input
                      aria-label="Minha parte"
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
                    Valor da minha parte
                  </span>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-500">
                      R$
                    </span>
                  <input
                    aria-label="Valor da minha parte"
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

              {modoDivisao === "vinculada" && (
                <LinkedDivisionPanel
                  apelidoContato={apelidoContato}
                  contatos={contatosDivisaoQuery.data ?? []}
                  emailConvidado={emailConvidado}
                  isBuscando={resolverConvidadoMutation.isPending}
                  isCarregandoContatos={contatosDivisaoQuery.isLoading}
                  isParcelada={isParcelada || isFixa}
                  percentualConvidado={percentualConvidado}
                  percentualExterno={percentualExterno}
                  percentualMinhaParte={percentualMinhaParte}
                  resultadoBusca={convidadoResolvido}
                  salvarContato={salvarContato}
                  somaPercentual={somaPercentualDivisao}
                  temParteExterna={temParteExterna}
                  valorConvidado={valorConvidado}
                  valorExterno={valorExterno}
                  valorMinhaParte={valorMinhaParte}
                  valorTotal={numericValorTotal}
                  onApelidoContatoChange={setApelidoContato}
                  onBuscar={handleResolverConvidado}
                  onEmailChange={(value) => {
                    setEmailConvidado(value);
                    setConvidadoResolvido(null);
                  }}
                  onPercentualExternoChange={(value) =>
                    setPercentualParteExterna(limitarPercentual(value))
                  }
                  onSalvarContatoChange={setSalvarContato}
                  onTemParteExternaChange={(checked) => {
                    setTemParteExterna(checked);
                    if (!checked) setPercentualParteExterna("0");
                  }}
                />
              )}

              <DivisionSummary
                isCartao={formaPagamento === "Cartão de crédito" || (isParcelada && !isCarne)}
                isParcelada={isParcelada}
                modo={modoDivisao}
                nomeConvidado={descricaoConvidado}
                percentualConvidado={percentualConvidado}
                quantidadeParcelas={quantidadeParcelas || parcelasRestantes}
                temParteExterna={temParteExterna}
                valorConvidado={valorConvidado}
                valorExterno={valorExterno}
                valorMinhaParte={valorMinhaParte}
                valorTotal={numericValorTotal}
              />
            </div>
          )}

          {isEditingCompraParcelada && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              Esta alteração será aplicada da parcela{" "}
              {initialTransaction?.numeroParcela} em diante.
            </div>
          )}

          {tipo === "receita" && (
            <div className="space-y-4 py-1">
              <ToggleField
                checked={isFixa}
                label="Receita fixa"
                onChange={(checked) => setIsFixa(checked)}
              />
              {(reembolsosPendentesQuery.data?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                  <ToggleField
                    checked={vincularReembolso}
                    disabled={isFixa}
                    label="Vincular a um reembolso"
                    onChange={(checked) => {
                      setVincularReembolso(checked);
                      if (!checked) setReembolsoDivisaoId("");
                    }}
                  />
                  {vincularReembolso && (
                    <label className="mt-4 block space-y-1.5">
                      <span className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                        Reembolso
                      </span>
                      <select
                        aria-label="Reembolso"
                        className={`${inputClass} appearance-none border-emerald-200 bg-white dark:border-emerald-500/30`}
                        value={reembolsoDivisaoId}
                        onChange={(event) => {
                          const selectedId = event.target.value;
                          setReembolsoDivisaoId(selectedId);
                          const reembolso = reembolsosPendentesQuery.data?.find(
                            (item) => item.id === selectedId,
                          );
                          if (reembolso && !descricao.trim()) {
                            setDescricao(
                              `Reembolso de ${nomeParticipanteReembolso(reembolso)}`,
                            );
                          }
                          if (reembolso && !valor) {
                            setValor(formatCurrencyInput(reembolso.saldoPendente));
                          }
                        }}
                        required
                      >
                        <option value="">Selecione</option>
                        {reembolsosPendentesQuery.data?.map((reembolso) => (
                          <option key={reembolso.id} value={reembolso.id}>
                            {nomeParticipanteReembolso(reembolso)} —{" "}
                            {formatCurrency(reembolso.saldoPendente)}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs leading-5 text-emerald-800 dark:text-emerald-100/80">
                        Reembolso aumenta o caixa, mas não entra como renda recorrente nem na taxa de economia.
                      </p>
                    </label>
                  )}
                </div>
              )}
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
                    setContaBancariaId("");
                  } else if (event.target.value === "Cartão de crédito") {
                    setContaBancariaId("");
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

          {cartaoNecessario && (
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

          {(tipo === "despesa" || tipo === "receita") &&
            !isParcelada &&
            formaPagamento !== "Cartão de crédito" && (
              <IconField
                label={
                  tipo === "receita"
                    ? "Creditar na Conta"
                    : "Debitar da Conta"
                }
                icon={<Landmark size={16} />}
              >
                <select
                  className={`${inputClass} appearance-none`}
                  value={contaBancariaId}
                  onChange={(event) => setContaBancariaId(event.target.value)}
                >
                  <option value="">Não informar</option>
                  {contas.map((conta) => (
                    <option key={conta.id} value={conta.id}>
                      {conta.nomeCustomizado}
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

        <div className="flex flex-col-reverse gap-3 border-t border-[color:var(--app-card-border)] bg-slate-50/80 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:justify-end sm:px-6 sm:py-5">
          <button
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            type="button"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            className="min-h-11 rounded-xl bg-[var(--app-accent)] px-6 py-2.5 text-sm font-bold text-[var(--app-accent-contrast)] shadow-sm transition-colors hover:opacity-90 disabled:opacity-60 dark:bg-white dark:text-slate-950"
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
                  onCancel();
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
    setModoDivisao("manual");
    setPercentualDivisao(String(percentualPadraoDivisao));
    setEmailConvidado("");
    setConvidadoResolvido(null);
    setSalvarContato(true);
    setApelidoContato("");
    setTemParteExterna(false);
    setPercentualParteExterna("0");
    setVincularReembolso(false);
    setReembolsoDivisaoId("");
    setData(toDateInputValue(new Date()));
    setCategoriaId(categoriasOrdenadas[0]?.id ?? "");
    setFormaPagamento("Pix");
    setCartaoCreditoId("");
    setContaBancariaId("");
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

function LinkedDivisionPanel({
  apelidoContato,
  contatos,
  emailConvidado,
  isBuscando,
  isCarregandoContatos,
  isParcelada,
  percentualConvidado,
  percentualExterno,
  percentualMinhaParte,
  resultadoBusca,
  salvarContato,
  somaPercentual,
  temParteExterna,
  valorConvidado,
  valorExterno,
  valorMinhaParte,
  valorTotal,
  onApelidoContatoChange,
  onBuscar,
  onEmailChange,
  onPercentualExternoChange,
  onSalvarContatoChange,
  onTemParteExternaChange,
}: {
  apelidoContato: string;
  contatos: Array<{
    id: string;
    nomeExibicao: string;
    emailMascarado: string;
    apelido: string | null;
    ultimoUsoEm: string | null;
  }>;
  emailConvidado: string;
  isBuscando: boolean;
  isCarregandoContatos: boolean;
  isParcelada: boolean;
  percentualConvidado: number;
  percentualExterno: number;
  percentualMinhaParte: number;
  resultadoBusca: ResolverConvidadoDivisaoResponse | null;
  salvarContato: boolean;
  somaPercentual: number;
  temParteExterna: boolean;
  valorConvidado: number;
  valorExterno: number;
  valorMinhaParte: number;
  valorTotal: number;
  onApelidoContatoChange: (value: string) => void;
  onBuscar: () => void;
  onEmailChange: (value: string) => void;
  onPercentualExternoChange: (value: string) => void;
  onSalvarContatoChange: (checked: boolean) => void;
  onTemParteExternaChange: (checked: boolean) => void;
}) {
  const recentes = [...contatos]
    .filter((contato) => contato.emailMascarado)
    .sort((a, b) => {
      const left = a.ultimoUsoEm ? Date.parse(a.ultimoUsoEm) : 0;
      const right = b.ultimoUsoEm ? Date.parse(b.ultimoUsoEm) : 0;
      return right - left;
    })
    .slice(0, 4);

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block space-y-1.5">
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
            Dividir restante com
          </span>
          <input
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-base text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            inputMode="email"
            placeholder="Buscar contato ou informar e-mail"
            type="email"
            value={emailConvidado}
            onChange={(event) => onEmailChange(event.target.value)}
          />
        </label>
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
          type="button"
          disabled={isBuscando}
          onClick={onBuscar}
        >
          <Search size={16} />
          {isBuscando ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {recentes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
            Contatos recentes
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {recentes.map((contato) => (
              <div
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                key={contato.id}
              >
                <p className="font-bold text-slate-900 dark:text-white">
                  {contato.apelido || contato.nomeExibicao}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {contato.emailMascarado}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Por segurança, o convite exige informar o e-mail completo no campo acima.
          </p>
        </div>
      )}

      {isCarregandoContatos && (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
          Carregando contatos salvos...
        </p>
      )}

      {!isCarregandoContatos && recentes.length === 0 && !resultadoBusca && (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
          Adicionar pelo e-mail
        </p>
      )}

      {resultadoBusca && (
        <div
          className={`rounded-xl border px-3 py-2 text-sm ${
            resultadoBusca.encontrado
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100"
              : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
          }`}
        >
          {resultadoBusca.encontrado ? (
            <>
              <p className="font-black">{resultadoBusca.nomeExibicao}</p>
              <p>{resultadoBusca.emailMascarado}</p>
            </>
          ) : (
            <p className="font-semibold">Nenhum usuário encontrado para este e-mail.</p>
          )}
        </div>
      )}

      {resultadoBusca?.encontrado && (
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleField
            checked={salvarContato}
            label="Salvar nos meus contatos"
            onChange={onSalvarContatoChange}
          />
          {salvarContato && (
            <input
              className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-base text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              maxLength={120}
              placeholder="Apelido opcional"
              value={apelidoContato}
              onChange={(event) => onApelidoContatoChange(event.target.value)}
            />
          )}
        </div>
      )}

      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
        <ToggleField
          checked={temParteExterna}
          label="Existe também uma parte de pessoa externa"
          onChange={onTemParteExternaChange}
        />
        {temParteExterna && (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Parte externa
            </span>
            <div className="relative max-w-40">
              <input
                aria-label="Percentual da parte externa"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-9 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                inputMode="decimal"
                value={String(percentualExterno).replace(".", ",")}
                onChange={(event) => onPercentualExternoChange(event.target.value)}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500">
                %
              </span>
            </div>
          </label>
        )}
        <div className="grid gap-2 text-sm text-slate-700 dark:text-slate-200">
          <PercentRow label="Você" percent={percentualMinhaParte} value={valorMinhaParte} />
          <PercentRow label={resultadoBusca?.nomeExibicao ?? "Convidado"} percent={percentualConvidado} value={valorConvidado} />
          {temParteExterna && (
            <PercentRow label="Parte externa" percent={percentualExterno} value={valorExterno} />
          )}
        </div>
        <p
          className={`text-xs font-bold ${
            somaPercentual === 100
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-red-600 dark:text-red-300"
          }`}
        >
          Soma: {somaPercentual.toLocaleString("pt-BR")}% de 100%
        </p>
      </div>

      {isParcelada && (
        <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
          O percentual informado vale para cada ocorrência. Em despesas fixas, um único aceite vale para as ocorrências futuras da série.
        </p>
      )}

      {valorTotal > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Valor total: {formatCurrency(valorTotal)} · Minha parte:{" "}
          {percentualMinhaParte.toLocaleString("pt-BR")}%
        </p>
      )}
    </div>
  );
}

function DivisionSummary({
  isCartao,
  isParcelada,
  modo,
  nomeConvidado,
  percentualConvidado,
  quantidadeParcelas,
  temParteExterna,
  valorConvidado,
  valorExterno,
  valorMinhaParte,
  valorTotal,
}: {
  isCartao: boolean;
  isParcelada: boolean;
  modo: "manual" | "vinculada";
  nomeConvidado: string;
  percentualConvidado: number;
  quantidadeParcelas: number;
  temParteExterna: boolean;
  valorConvidado: number;
  valorExterno: number;
  valorMinhaParte: number;
  valorTotal: number;
}) {
  const aReceber = modo === "vinculada" ? valorConvidado + valorExterno : 0;
  const quantidadeParcelasSegura = Math.max(1, quantidadeParcelas || 1);
  const valorParcela = isParcelada ? valorTotal / quantidadeParcelasSegura : valorTotal;
  const valorMinhaParteParcela = isParcelada ? valorMinhaParte / quantidadeParcelasSegura : valorMinhaParte;
  const valorConvidadoParcela = isParcelada ? valorConvidado / quantidadeParcelasSegura : valorConvidado;
  const valorExternoParcela = isParcelada ? valorExterno / quantidadeParcelasSegura : valorExterno;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
        <Users size={16} />
        Resumo
        {isCartao && modo === "vinculada" && (
          <InfoTooltip label="Como a divisão aparece na fatura">
            O valor total será cobrado na sua fatura. Nos seus relatórios de gastos será considerada apenas a sua parte.
          </InfoTooltip>
        )}
      </div>
      <div className="space-y-2 text-sm">
        <SummaryRow label={isCartao ? "Valor na fatura" : "Total da despesa"} value={valorTotal} />
        <SummaryRow label={isCartao ? "Seu gasto pessoal" : "Sua parte"} value={valorMinhaParte} />
        {modo === "vinculada" && (
          <>
            <SummaryRow label={nomeConvidado} detail={`${percentualConvidado.toLocaleString("pt-BR")}%`} value={valorConvidado} />
            {temParteExterna && <SummaryRow label="Parte externa" value={valorExterno} />}
            <SummaryRow label={isCartao ? "Parte de terceiros" : "A receber"} strong value={aReceber} />
          </>
        )}
      </div>
      {isCartao && modo === "vinculada" && (
        <p className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
          Compra total: {formatCurrency(valorTotal)}. Na fatura: {formatCurrency(valorTotal)}. Nos seus gastos: {formatCurrency(valorMinhaParte)}.
        </p>
      )}
      {isParcelada && valorTotal > 0 && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
          <p>
            {quantidadeParcelasSegura} parcelas de {formatCurrency(valorParcela)}.
          </p>
          <p>Sua parte mensal: {formatCurrency(valorMinhaParteParcela)}.</p>
          {modo === "vinculada" && (
            <p>
              {nomeConvidado}: {formatCurrency(valorConvidadoParcela)}
              {temParteExterna ? ` · Parte externa: ${formatCurrency(valorExternoParcela)}` : ""}
            </p>
          )}
          <p>Os percentuais serão aplicados separadamente em cada parcela.</p>
        </div>
      )}
    </div>
  );
}

function PercentRow({
  label,
  percent,
  value,
}: {
  label: string;
  percent: number;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="text-right font-bold">
        {percent.toLocaleString("pt-BR")}% · {formatCurrency(value)}
      </span>
    </div>
  );
}

function SummaryRow({
  detail,
  label,
  strong,
  value,
}: {
  detail?: string;
  label: string;
  strong?: boolean;
  value: number;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 ${
        strong ? "border-t border-slate-200 pt-2 font-black dark:border-slate-800" : ""
      }`}
    >
      <span className="text-slate-600 dark:text-slate-300">
        {label}
        {detail ? <span className="ml-1 text-xs text-slate-400">({detail})</span> : null}
      </span>
      <span className="shrink-0 font-bold text-slate-900 dark:text-white">
        {formatCurrency(value)}
      </span>
    </div>
  );
}

function RadioOption({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
      <input
        checked={checked}
        className="h-4 w-4 accent-[var(--app-accent)]"
        type="radio"
        onChange={onChange}
      />
      {label}
    </label>
  );
}

function extractApiError(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : fallback;
  }

  const data = error.response?.data as
    | { message?: string; errors?: Record<string, string[]> }
    | undefined;

  if (data?.message) {
    return data.message;
  }

  const validationMessage = data?.errors
    ? Object.values(data.errors).flat().find(Boolean)
    : null;

  return validationMessage ?? fallback;
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
}

function nomeParticipanteReembolso(reembolso: ReembolsoDivisao) {
  return reembolso.participanteExternoNome || "Participante";
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

import { FormEvent, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, CreditCard, FileText, Landmark, Plus, Search, Tag, Trash2, Users } from "lucide-react";
import { InfoTooltip } from "./InfoTooltip";
import * as financeService from "../services/financeService";
import { queryKeys } from "../hooks/queries/queryKeys";
import { AuthContext } from "../contexts/authContextCore";
import type {
  CartaoCredito,
  CartaoCreditoOpcao,
  Categoria,
  ContatoDivisao,
  ContaBancaria,
  CriarCompraParceladaRequest,
  CriarTransacaoRequest,
  DivisaoParticipante,
  DivisaoTransacao,
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

type ParticipanteUsuarioForm = {
  key: string;
  participanteId?: string;
  contatoId: string | null;
  usuarioId: string | null;
  email: string | null;
  nome: string;
  emailMascarado: string | null;
  percentual: string;
  salvarContato: boolean;
  apelidoContato: string;
  status?: number | string;
};

type ParticipanteExternoForm = {
  key: string;
  participanteId?: string;
  nome: string;
  modo: "Percentual" | "Valor";
  entrada: string;
  status?: number | string;
};

type ParticipanteCalculado = {
  key: string;
  nome: string;
  percentual: number;
  valor: number;
  externo: boolean;
  status?: number | string;
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
  const user = useContext(AuthContext)?.user ?? null;
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
  const [termoParticipante, setTermoParticipante] = useState("");
  const [resultadoParticipante, setResultadoParticipante] =
    useState<ResolverConvidadoDivisaoResponse | null>(null);
  const [participantesUsuarios, setParticipantesUsuarios] = useState<ParticipanteUsuarioForm[]>([]);
  const [participantesExternos, setParticipantesExternos] = useState<ParticipanteExternoForm[]>([]);
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
  const [escopoAlteracao, setEscopoAlteracao] = useState<"EstaOcorrencia" | "EstaEProximas">(
    "EstaOcorrencia",
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
    onSuccess: (data) => setResultadoParticipante(data),
    onError: (error) => {
      setResultadoParticipante(null);
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
  const possuiDivisaoVinculadaExistente = Boolean(
    initialTransaction?.divisaoTransacaoId,
  );
  const divisaoExistenteQuery = useQuery({
    queryKey: queryKeys.divisaoTransacao(initialTransaction?.divisaoTransacaoId ?? ""),
    queryFn: ({ signal }) => financeService.obterDivisaoTransacao(
      initialTransaction!.divisaoTransacaoId!,
      signal,
    ),
    enabled: possuiDivisaoVinculadaExistente,
  });
  const divisaoExistente = divisaoExistenteQuery.data;
  const usuarioEhCriador = Boolean(
    divisaoExistente && user?.id === divisaoExistente.usuarioCriadorId,
  );
  const podeProporAlteracao = Boolean(
    usuarioEhCriador &&
      (divisaoExistente?.status === "Aceita" || divisaoExistente?.status === 3),
  );
  const alteracaoPendente = divisaoExistente?.versoes.find(isVersaoPendente) ?? null;
  const isCarne = formaPagamento === "Carnê/Crediário";
  const parcelasRestantes =
    initialTransaction?.numeroParcela && initialTransaction?.quantidadeParcelas
      ? initialTransaction.quantidadeParcelas -
        initialTransaction.numeroParcela +
        1
      : quantidadeParcelas;
  const percentualMinhaParte = parsePercentual(percentualDivisao);
  const numericValorTotal = parseBrlCurrency(valor);
  const participantesCalculados = useMemo(
    () => calcularParticipantes(
      numericValorTotal,
      participantesUsuarios,
      participantesExternos,
    ),
    [numericValorTotal, participantesExternos, participantesUsuarios],
  );
  const valorMinhaParte = isDividida
    ? calcularParteNumerica(numericValorTotal, percentualMinhaParte)
    : numericValorTotal;
  const valorTotalEconomico = isEditingCompraParcelada
    ? arredondarDinheiro(numericValorTotal * parcelasRestantes)
    : numericValorTotal;
  const valorMinhaParteEconomico = isEditingCompraParcelada
    ? arredondarDinheiro(valorMinhaParte * parcelasRestantes)
    : valorMinhaParte;
  const somaPercentualDivisao = arredondarPercentual(
    percentualMinhaParte + participantesCalculados.somaPercentual,
  );
  const somaMonetariaDivisao = arredondarDinheiro(
    valorMinhaParte + participantesCalculados.somaValor,
  );
  const divisaoVinculadaAtiva =
    tipo === "despesa" && isDividida && modoDivisao === "vinculada";
  const criandoPrimeiraDivisaoVinculada =
    divisaoVinculadaAtiva && !possuiDivisaoVinculadaExistente;
  const alteracaoEconomicaDetectada = useMemo(() => {
    if (!divisaoExistente || !usuarioEhCriador) {
      return false;
    }

    const criador = divisaoExistente.participantes.find(isParticipanteCriador);
    if (!criador || Math.abs(valorTotalEconomico - divisaoExistente.valorTotal) > 0.01 ||
        Math.abs(percentualMinhaParte - criador.percentual) > 0.01) {
      return true;
    }

    const atuais = new Map(
      divisaoExistente.participantes
        .filter((item) => item.ativo && !isParticipanteCriador(item))
        .map((item) => [item.id, item]),
    );
    const informados = [...participantesUsuarios, ...participantesExternos]
      .filter((item) => item.participanteId);
    if (informados.length !== atuais.size) {
      return true;
    }

    return informados.some((item) => {
      const atual = atuais.get(item.participanteId!);
      if (!atual) return true;
      const percentual = "modo" in item
        ? item.modo === "Valor"
          ? percentualPorValor(valorTotalEconomico, parseBrlCurrency(item.entrada))
          : parsePercentual(item.entrada)
        : parsePercentual(item.percentual);
      const valorCalculado = "modo" in item && item.modo === "Valor"
        ? parseBrlCurrency(item.entrada)
        : calcularParteNumerica(valorTotalEconomico, percentual);
      return Math.abs(percentual - atual.percentual) > 0.01 ||
        Math.abs(valorCalculado - atual.valor) > 0.01;
    });
  }, [
    divisaoExistente,
    valorTotalEconomico,
    participantesExternos,
    participantesUsuarios,
    percentualMinhaParte,
    usuarioEhCriador,
  ]);

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
      setTermoParticipante("");
      setResultadoParticipante(null);
      setParticipantesUsuarios([]);
      setParticipantesExternos([]);
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
      setEscopoAlteracao("EstaOcorrencia");
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
    setModoDivisao(initialTransaction.divisaoTransacaoId ? "vinculada" : "manual");
    setTermoParticipante("");
    setResultadoParticipante(null);
    setParticipantesUsuarios([]);
    setParticipantesExternos([]);
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
    setEscopoAlteracao("EstaOcorrencia");
    setErro(null);
    setIsRepeatPromptOpen(false);
  }, [
    categoriasOrdenadas,
    initialTransaction,
    percentualPadraoDivisao,
  ]);

  useEffect(() => {
    if (!divisaoExistente || !usuarioEhCriador) {
      return;
    }

    const criador = divisaoExistente.participantes.find(isParticipanteCriador);
    if (criador) {
      setPercentualDivisao(formatarPercentualInput(criador.percentual));
      setMeuValor(formatCurrencyInput(criador.valor));
    }

    setParticipantesUsuarios(
      divisaoExistente.participantes
        .filter(isParticipanteUsuario)
        .map((participante) => ({
          key: participante.id,
          participanteId: participante.id,
          contatoId: null,
          usuarioId: participante.participanteUsuarioId,
          email: null,
          nome: participante.nomeExibicao || participante.emailMascarado || "Participante",
          emailMascarado: participante.emailMascarado ?? null,
          percentual: formatarPercentualInput(participante.percentual),
          salvarContato: false,
          apelidoContato: "",
          status: participante.status,
        })),
    );
    setParticipantesExternos(
      divisaoExistente.participantes
        .filter(isParticipanteExterno)
        .map((participante) => ({
          key: participante.id,
          participanteId: participante.id,
          nome: participante.nomeExibicao || "Participante externo",
          modo: isModoValor(participante.modoDefinicao) ? "Valor" : "Percentual",
          entrada: isModoValor(participante.modoDefinicao)
            ? formatCurrencyInput(participante.valor)
            : formatarPercentualInput(participante.percentual),
          status: participante.status,
        })),
    );
  }, [divisaoExistente, usuarioEhCriador]);

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
    const termo = termoParticipante.trim();
    if (!termo) {
      setErro("Informe um contato ou o e-mail completo do convidado.");
      return;
    }

    if (!termo.includes("@")) {
      const contatosEncontrados = (contatosDivisaoQuery.data ?? []).filter((contato) =>
        contatoCorrespondeAoTermo(contato, termo),
      );
      if (contatosEncontrados.length === 1) {
        adicionarContato(contatosEncontrados[0]);
        return;
      }

      setErro(
        contatosEncontrados.length > 1
          ? "Selecione um dos contatos encontrados."
          : "Nenhum contato encontrado com esse nome ou apelido.",
      );
      return;
    }

    const resultado = await resolverConvidadoMutation.mutateAsync(termo);
    if (resultado.encontrado) {
      adicionarUsuarioResolvido(resultado, termo);
    }
  }

  function adicionarContato(contato: ContatoDivisao) {
    setErro(null);
    if (!podeAdicionarUsuario(contato.usuarioContatoId, contato.id)) {
      return;
    }
    setParticipantesUsuarios((atuais) => [
      ...atuais,
      {
        key: criarChaveTemporaria(),
        contatoId: contato.id,
        usuarioId: contato.usuarioContatoId,
        email: null,
        nome: contato.apelido || contato.nomeExibicao,
        emailMascarado: contato.emailMascarado,
        percentual: percentualRestanteInput(),
        salvarContato: false,
        apelidoContato: contato.apelido ?? "",
      },
    ]);
    limparBuscaParticipante();
  }

  function adicionarUsuarioResolvido(
    resultado: ResolverConvidadoDivisaoResponse,
    email: string,
  ) {
    if (!resultado.identificador || !podeAdicionarUsuario(resultado.identificador, null)) {
      return;
    }
    setParticipantesUsuarios((atuais) => [
      ...atuais,
      {
        key: criarChaveTemporaria(),
        contatoId: null,
        usuarioId: resultado.identificador,
        email,
        nome: resultado.nomeExibicao || resultado.emailMascarado || "Participante",
        emailMascarado: resultado.emailMascarado,
        percentual: percentualRestanteInput(),
        salvarContato: true,
        apelidoContato: "",
      },
    ]);
    limparBuscaParticipante();
  }

  function podeAdicionarUsuario(usuarioId: string, contatoId: string | null) {
    if (usuarioId === user?.id) {
      setErro("Você não pode adicionar a si mesmo à divisão.");
      return false;
    }
    if (participantesUsuarios.some((item) =>
      item.usuarioId === usuarioId || (contatoId && item.contatoId === contatoId),
    )) {
      setErro("Esta pessoa já foi adicionada à divisão.");
      return false;
    }
    return true;
  }

  function percentualRestanteInput() {
    const restante = Math.max(0, arredondarPercentual(100 - percentualMinhaParte - participantesCalculados.somaPercentual));
    return formatarPercentualInput(restante);
  }

  function limparBuscaParticipante() {
    setTermoParticipante("");
    setResultadoParticipante(null);
  }

  function atualizarParticipanteUsuario(key: string, patch: Partial<ParticipanteUsuarioForm>) {
    setParticipantesUsuarios((atuais) =>
      atuais.map((item) => item.key === key ? { ...item, ...patch } : item),
    );
  }

  function atualizarParticipanteExterno(key: string, patch: Partial<ParticipanteExternoForm>) {
    setParticipantesExternos((atuais) =>
      atuais.map((item) => item.key === key ? { ...item, ...patch } : item),
    );
  }

  function adicionarParticipanteExterno() {
    setParticipantesExternos((atuais) => [
      ...atuais,
      {
        key: criarChaveTemporaria(),
        nome: "",
        modo: "Percentual",
        entrada: percentualRestanteInput(),
      },
    ]);
  }

  async function criarConviteParaTransacao(transacaoOrigemId: string) {
    await financeService.criarConviteDivisao({
      transacaoOrigemId,
      participantesUsuarios: mapearParticipantesUsuariosRequest(participantesUsuarios),
      participantesExternos: mapearParticipantesExternosRequest(participantesExternos),
    });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.contatosDivisao }),
      queryClient.invalidateQueries({ queryKey: queryKeys.notificacoesNaoLidas }),
      queryClient.invalidateQueries({ queryKey: queryKeys.extratoScope }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardScope }),
      queryClient.invalidateQueries({ queryKey: queryKeys.relatoriosScope }),
    ]);
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

      if (divisaoVinculadaAtiva && (!possuiDivisaoVinculadaExistente || podeProporAlteracao)) {
        if (!possuiDivisaoVinculadaExistente && participantesUsuarios.length === 0) {
          throw new Error("Adicione ao menos um usuário antes de salvar a divisão vinculada.");
        }

        if (
          numericPercentual <= 0 ||
          participantesCalculados.temParteInvalida ||
          Math.abs(somaPercentualDivisao - 100) > 0.01 ||
          Math.abs(somaMonetariaDivisao - numericValue) > 0.01
        ) {
          throw new Error(mensagemDistribuicao(numericValue, somaMonetariaDivisao));
        }
      }

      if (tipo === "despesa" && !categoriaId) {
        throw new Error("Selecione uma categoria.");
      }

      const divisaoVinculadaParcelada = criandoPrimeiraDivisaoVinculada
        ? {
            participantesUsuarios: mapearParticipantesUsuariosRequest(participantesUsuarios),
            participantesExternos: mapearParticipantesExternosRequest(participantesExternos),
          }
        : null;

      if (
        possuiDivisaoVinculadaExistente &&
        usuarioEhCriador &&
        alteracaoEconomicaDetectada &&
        divisaoExistente
      ) {
        if (alteracaoPendente) {
          throw new Error("Já existe uma alteração pendente. Aguarde a resposta ou revise a proposta atual.");
        }
        if (!podeProporAlteracao) {
          throw new Error("A situação atual da divisão não permite uma nova proposta econômica.");
        }
        await financeService.proporAlteracaoDivisao(divisaoExistente.id, {
          escopo: isEditingCompraParcelada ? "EstaEProximas" : isFixa ? escopoAlteracao : "EstaOcorrencia",
          valorTotal: Math.abs(valorTotalEconomico - divisaoExistente.valorTotal) > 0.01
            ? valorTotalEconomico
            : null,
          vencimento: null,
          quantidadeParcelas: isEditingCompraParcelada &&
            parcelasRestantes !== divisaoExistente.quantidadeParcelas
              ? parcelasRestantes
              : null,
          participantes: [
            ...participantesUsuarios,
            ...participantesExternos,
          ].flatMap((participante) => participante.participanteId
            ? [{
                participanteId: participante.participanteId,
                percentual: "modo" in participante
                  ? participante.modo === "Valor"
                    ? percentualPorValor(valorTotalEconomico, parseBrlCurrency(participante.entrada))
                    : parsePercentual(participante.entrada)
                  : parsePercentual(participante.percentual),
              }]
            : []),
        });
        await invalidarDivisaoEFinanceiro(divisaoExistente.id);
        onCancel();
        return;
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
            divisaoVinculada: divisaoVinculadaParcelada,
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
          divisaoVinculada: divisaoVinculadaParcelada,
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
          if (criandoPrimeiraDivisaoVinculada) {
            await criarConviteParaTransacao(initialTransaction.id);
          }
        } else {
          const transacaoCriada = await onCreateTransacao(request);
          if (divisaoVinculadaAtiva && transacaoCriada?.id) {
            await criarConviteParaTransacao(transacaoCriada.id);
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

  async function invalidarDivisaoEFinanceiro(divisaoId: string) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.divisaoTransacao(divisaoId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.notificacoesNaoLidas }),
      queryClient.invalidateQueries({ queryKey: queryKeys.extratoScope }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardScope }),
      queryClient.invalidateQueries({ queryKey: queryKeys.relatoriosScope }),
    ]);
  }

  return (
    <div className={variant === "page" ? "contents" : "relative contents"}>
      <form
        className={
          variant === "page"
            ? "flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-3xl border border-[color:var(--app-card-border)] bg-[var(--app-card)] shadow-xl dark:border-slate-800 dark:bg-slate-900"
            : "flex h-full min-h-0 w-full max-w-lg flex-col overflow-hidden bg-[var(--app-card)] dark:bg-slate-900 sm:max-h-[calc(100dvh-2rem)]"
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
                  disabled={possuiDivisaoVinculadaExistente && !podeProporAlteracao}
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
                disabled={possuiDivisaoVinculadaExistente}
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
              {possuiDivisaoVinculadaExistente && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                  <p className="font-bold">Divisão vinculada existente</p>
                  <p className="mt-1">
                    {alteracaoPendente
                      ? "A versão vigente continua ativa enquanto os participantes analisam a proposta pendente."
                      : podeProporAlteracao
                      ? "Mudanças de valor ou percentual serão enviadas como proposta aos participantes afetados. Categoria, descrição e data local continuam editáveis diretamente."
                      : "Você pode ajustar os dados locais permitidos. Valor e percentual compartilhados permanecem protegidos."}
                  </p>
                  {alteracaoPendente && (
                    <p className="mt-2 font-bold">Alteração pendente</p>
                  )}
                  {initialTransaction?.divisaoTransacaoId && (
                    <p className="mt-2 text-xs font-semibold">
                      Divisão: {initialTransaction.divisaoTransacaoId}
                      {initialTransaction.statusDivisao ? ` · Status: ${initialTransaction.statusDivisao}` : ""}
                    </p>
                  )}
                </div>
              )}
              <fieldset className="space-y-3">
                <legend className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Tipo de divisão
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  <RadioOption
                    checked={modoDivisao === "manual"}
                    disabled={possuiDivisaoVinculadaExistente}
                    label="Apenas informar minha parte"
                    onChange={() => setModoDivisao("manual")}
                  />
                  <RadioOption
                    checked={modoDivisao === "vinculada"}
                    disabled={possuiDivisaoVinculadaExistente}
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
                      disabled={possuiDivisaoVinculadaExistente && !podeProporAlteracao}
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
                      disabled={possuiDivisaoVinculadaExistente && !podeProporAlteracao}
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

              {modoDivisao === "vinculada" && (!possuiDivisaoVinculadaExistente || usuarioEhCriador) && (
                <LinkedDivisionPanel
                  canAddParticipants={!possuiDivisaoVinculadaExistente}
                  canEditEconomic={!possuiDivisaoVinculadaExistente || podeProporAlteracao}
                  contatos={contatosDivisaoQuery.data ?? []}
                  isBuscando={resolverConvidadoMutation.isPending}
                  isCarregandoContatos={contatosDivisaoQuery.isLoading}
                  isParcelada={isParcelada || isFixa}
                  percentualMinhaParte={percentualMinhaParte}
                  participantesExternos={participantesExternos}
                  participantesUsuarios={participantesUsuarios}
                  resultadoBusca={resultadoParticipante}
                  somaPercentual={somaPercentualDivisao}
                  somaValor={somaMonetariaDivisao}
                  termoBusca={termoParticipante}
                  valorMinhaParte={valorMinhaParte}
                  valorTotal={numericValorTotal}
                  onAdicionarExterno={adicionarParticipanteExterno}
                  onBuscar={handleResolverConvidado}
                  onBuscaChange={(value) => {
                    setTermoParticipante(value);
                    setResultadoParticipante(null);
                  }}
                  onRemoverExterno={(key) => setParticipantesExternos((atuais) => atuais.filter((item) => item.key !== key))}
                  onRemoverUsuario={(key) => setParticipantesUsuarios((atuais) => atuais.filter((item) => item.key !== key))}
                  onSelecionarContato={adicionarContato}
                  onAtualizarExterno={atualizarParticipanteExterno}
                  onAtualizarUsuario={atualizarParticipanteUsuario}
                />
              )}

              <DivisionSummary
                isCartao={formaPagamento === "Cartão de crédito" || (isParcelada && !isCarne)}
                isParcelada={isParcelada}
                modo={modoDivisao}
                participantes={participantesCalculados.itens}
                quantidadeParcelas={quantidadeParcelas || parcelasRestantes}
                valorMinhaParte={valorMinhaParte}
                valorTotal={numericValorTotal}
              />

              {possuiDivisaoVinculadaExistente && usuarioEhCriador && alteracaoEconomicaDetectada && divisaoExistente && (
                <EconomicChangePreview
                  current={divisaoExistente}
                  participants={participantesCalculados.itens}
                  scope={isEditingCompraParcelada ? "EstaEProximas" : isFixa ? escopoAlteracao : "EstaOcorrencia"}
                  selectedDate={data}
                  userValue={valorMinhaParteEconomico}
                  value={valorTotalEconomico}
                />
              )}

              {possuiDivisaoVinculadaExistente && usuarioEhCriador && alteracaoEconomicaDetectada && isFixa && (
                <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <legend className="px-1 text-sm font-bold text-slate-800 dark:text-slate-100">
                    Aplicar alteração
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <RadioOption
                      checked={escopoAlteracao === "EstaOcorrencia"}
                      label="Somente este mês"
                      onChange={() => setEscopoAlteracao("EstaOcorrencia")}
                    />
                    <RadioOption
                      checked={escopoAlteracao === "EstaEProximas"}
                      label="Este mês e próximos"
                      onChange={() => setEscopoAlteracao("EstaEProximas")}
                    />
                  </div>
                </fieldset>
              )}
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
            disabled={isSubmitting || (possuiDivisaoVinculadaExistente && divisaoExistenteQuery.isLoading)}
          >
            {isSubmitting
              ? "Salvando..."
              : possuiDivisaoVinculadaExistente && alteracaoEconomicaDetectada
                ? "Enviar proposta"
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
    setTermoParticipante("");
    setResultadoParticipante(null);
    setParticipantesUsuarios([]);
    setParticipantesExternos([]);
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
    setEscopoAlteracao("EstaOcorrencia");
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

function normalizarTermoContato(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function contatoCorrespondeAoTermo(contato: ContatoDivisao, termo: string) {
  const termoNormalizado = normalizarTermoContato(termo);
  return [contato.apelido, contato.nomeExibicao]
    .filter((value): value is string => Boolean(value))
    .some((value) => normalizarTermoContato(value).includes(termoNormalizado));
}

function LinkedDivisionPanel({
  canAddParticipants,
  canEditEconomic,
  contatos,
  isBuscando,
  isCarregandoContatos,
  isParcelada,
  participantesExternos,
  participantesUsuarios,
  percentualMinhaParte,
  somaPercentual,
  somaValor,
  termoBusca,
  valorMinhaParte,
  valorTotal,
  onAdicionarExterno,
  onAtualizarExterno,
  onAtualizarUsuario,
  onBuscar,
  onBuscaChange,
  onRemoverExterno,
  onRemoverUsuario,
  onSelecionarContato,
}: {
  canAddParticipants: boolean;
  canEditEconomic: boolean;
  contatos: ContatoDivisao[];
  isBuscando: boolean;
  isCarregandoContatos: boolean;
  isParcelada: boolean;
  participantesExternos: ParticipanteExternoForm[];
  participantesUsuarios: ParticipanteUsuarioForm[];
  percentualMinhaParte: number;
  resultadoBusca: ResolverConvidadoDivisaoResponse | null;
  somaPercentual: number;
  somaValor: number;
  termoBusca: string;
  valorMinhaParte: number;
  valorTotal: number;
  onAdicionarExterno: () => void;
  onAtualizarExterno: (key: string, patch: Partial<ParticipanteExternoForm>) => void;
  onAtualizarUsuario: (key: string, patch: Partial<ParticipanteUsuarioForm>) => void;
  onBuscar: () => void;
  onBuscaChange: (value: string) => void;
  onRemoverExterno: (key: string) => void;
  onRemoverUsuario: (key: string) => void;
  onSelecionarContato: (contato: ContatoDivisao) => void;
}) {
  const recentes = [...contatos]
    .filter((contato) => contato.emailMascarado)
    .sort((a, b) => {
      const left = a.ultimoUsoEm ? Date.parse(a.ultimoUsoEm) : 0;
      const right = b.ultimoUsoEm ? Date.parse(b.ultimoUsoEm) : 0;
      return right - left;
    })
    .slice(0, 4);
  const buscaNormalizada = normalizarTermoContato(termoBusca);
  const contatosExibidos = buscaNormalizada && !termoBusca.includes("@")
    ? contatos
        .filter((contato) => contatoCorrespondeAoTermo(contato, buscaNormalizada))
        .slice(0, 8)
    : recentes;
  const diferenca = arredondarDinheiro(valorTotal - somaValor);

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      {canAddParticipants && <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block space-y-1.5">
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
            Dividir restante com
          </span>
          <input
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-base text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            inputMode="search"
            placeholder="Buscar contato ou informar e-mail"
            type="text"
            value={termoBusca}
            onChange={(event) => onBuscaChange(event.target.value)}
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
      </div>}

      {canAddParticipants && contatosExibidos.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
            {buscaNormalizada ? "Contatos encontrados" : "Contatos recentes"}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {contatosExibidos.map((contato) => (
              <button
                aria-label={`Selecionar contato ${contato.apelido || contato.nomeExibicao}`}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm transition hover:border-slate-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-600 dark:hover:bg-slate-900"
                disabled={participantesUsuarios.some((item) => item.usuarioId === contato.usuarioContatoId)}
                key={contato.id}
                type="button"
                onClick={() => onSelecionarContato(contato)}
              >
                <p className="font-bold text-slate-900 dark:text-white">
                  {contato.apelido || contato.nomeExibicao}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {contato.emailMascarado}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {canAddParticipants && isCarregandoContatos && (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
          Carregando contatos salvos...
        </p>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Participantes</p>
          {canAddParticipants && <button className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold dark:border-slate-700" type="button" onClick={onAdicionarExterno}><Plus size={14} /> Pessoa externa</button>}
        </div>
        {participantesUsuarios.length === 0 && participantesExternos.length === 0 && (
          <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">Adicione uma pessoa para distribuir o restante.</p>
        )}
        {participantesUsuarios.map((participante) => (
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800" key={participante.key}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="truncate font-bold text-slate-900 dark:text-white">{participante.nome}</p><p className="truncate text-xs text-slate-500">{participante.emailMascarado}</p></div>
              {canAddParticipants && <button aria-label={`Remover ${participante.nome}`} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30" type="button" onClick={() => onRemoverUsuario(participante.key)}><Trash2 size={16} /></button>}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="relative block"><span className="sr-only">Percentual de {participante.nome}</span><input aria-label={`Percentual de ${participante.nome}`} className={inputClass} disabled={!canEditEconomic} inputMode="decimal" value={participante.percentual} onChange={(event) => onAtualizarUsuario(participante.key, { percentual: limitarPercentual(event.target.value) })} /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500">%</span></label>
              <p className="flex min-h-11 items-center font-bold text-slate-800 dark:text-slate-100">{formatCurrency(calcularParteNumerica(valorTotal, parsePercentual(participante.percentual)))}</p>
            </div>
            {!participante.contatoId && canAddParticipants && <div className="mt-3 grid gap-3 sm:grid-cols-2"><ToggleField checked={participante.salvarContato} label="Salvar nos meus contatos" onChange={(checked) => onAtualizarUsuario(participante.key, { salvarContato: checked })} />{participante.salvarContato && <input aria-label={`Apelido de ${participante.nome}`} className={inputClass} maxLength={120} placeholder="Apelido opcional" value={participante.apelidoContato} onChange={(event) => onAtualizarUsuario(participante.key, { apelidoContato: event.target.value })} />}</div>}
          </div>
        ))}
        {participantesExternos.map((participante, index) => (
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800" key={participante.key}>
            <div className="flex items-center justify-between gap-3"><p className="font-bold text-slate-900 dark:text-white">Pessoa externa {index + 1}</p>{canAddParticipants && <button aria-label={`Remover pessoa externa ${index + 1}`} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30" type="button" onClick={() => onRemoverExterno(participante.key)}><Trash2 size={16} /></button>}</div>
            <input aria-label={`Nome da pessoa externa ${index + 1}`} className={`${inputClass} mt-3`} disabled={!canEditEconomic} maxLength={160} placeholder="Nome (opcional)" value={participante.nome} onChange={(event) => onAtualizarExterno(participante.key, { nome: event.target.value })} />
            <div className="mt-3 grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
              <div className="flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800"><button className={`rounded-md px-3 py-2 text-xs font-bold ${participante.modo === "Percentual" ? "bg-white shadow dark:bg-slate-950" : ""}`} disabled={!canEditEconomic} type="button" onClick={() => onAtualizarExterno(participante.key, { modo: "Percentual", entrada: formatarPercentualInput(percentualPorValor(valorTotal, parseBrlCurrency(participante.entrada))) })}>%</button><button className={`rounded-md px-3 py-2 text-xs font-bold ${participante.modo === "Valor" ? "bg-white shadow dark:bg-slate-950" : ""}`} disabled={!canEditEconomic} type="button" onClick={() => onAtualizarExterno(participante.key, { modo: "Valor", entrada: formatCurrencyInput(calcularParteNumerica(valorTotal, parsePercentual(participante.entrada))) })}>R$</button></div>
              <input aria-label={`${participante.modo === "Valor" ? "Valor" : "Percentual"} da pessoa externa ${index + 1}`} className={inputClass} disabled={!canEditEconomic} inputMode={participante.modo === "Valor" ? "numeric" : "decimal"} value={participante.entrada} onChange={(event) => onAtualizarExterno(participante.key, { entrada: participante.modo === "Valor" ? maskBrlCurrencyInput(event.target.value) : limitarPercentual(event.target.value) })} />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{participante.modo === "Valor" ? `${formatarPercentualInput(percentualPorValor(valorTotal, parseBrlCurrency(participante.entrada)))}%` : formatCurrency(calcularParteNumerica(valorTotal, parsePercentual(participante.entrada)))}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950">
        <PercentRow label="Você" percent={percentualMinhaParte} value={valorMinhaParte} />
        <p className={`text-xs font-bold ${Math.abs(diferenca) <= 0.01 && Math.abs(somaPercentual - 100) <= 0.01 ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-300"}`}>{Math.abs(diferenca) <= 0.01 ? `Soma: ${somaPercentual.toLocaleString("pt-BR")}% · ${formatCurrency(somaValor)}` : diferenca > 0 ? `Falta distribuir ${formatCurrency(diferenca)}` : `Distribuição excede o total em ${formatCurrency(Math.abs(diferenca))}`}</p>
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
  participantes,
  quantidadeParcelas,
  valorMinhaParte,
  valorTotal,
}: {
  isCartao: boolean;
  isParcelada: boolean;
  modo: "manual" | "vinculada";
  participantes: ParticipanteCalculado[];
  quantidadeParcelas: number;
  valorMinhaParte: number;
  valorTotal: number;
}) {
  const aReceber = modo === "vinculada" ? participantes.reduce((total, item) => total + item.valor, 0) : 0;
  const quantidadeParcelasSegura = Math.max(1, quantidadeParcelas || 1);
  const valorParcela = isParcelada ? valorTotal / quantidadeParcelasSegura : valorTotal;
  const valorMinhaParteParcela = isParcelada ? valorMinhaParte / quantidadeParcelasSegura : valorMinhaParte;

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
            {participantes.map((participante) => <SummaryRow key={participante.key} label={participante.nome} detail={`${participante.percentual.toLocaleString("pt-BR")}%${participante.externo ? " · externo" : ""}`} value={participante.valor} />)}
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
          {modo === "vinculada" && participantes.map((participante) => <p key={participante.key}>{participante.nome}: {formatCurrency(isParcelada ? participante.valor / quantidadeParcelasSegura : participante.valor)}</p>)}
          <p>Os percentuais serão aplicados separadamente em cada parcela.</p>
        </div>
      )}
    </div>
  );
}

function EconomicChangePreview({
  current,
  participants,
  scope,
  selectedDate,
  userValue,
  value,
}: {
  current: DivisaoTransacao;
  participants: ParticipanteCalculado[];
  scope: "EstaOcorrencia" | "EstaEProximas";
  selectedDate: string;
  userValue: number;
  value: number;
}) {
  const currentCreator = current.participantes.find(isParticipanteCriador);
  const month = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${selectedDate}T00:00:00Z`));

  return (
    <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
      <p className="font-black">Prévia da alteração</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase opacity-70">Valor atual</p>
          <p className="mt-1 text-lg font-black">{formatCurrency(current.valorTotal)}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase opacity-70">Novo valor</p>
          <p className="mt-1 text-lg font-black">{formatCurrency(value)}</p>
        </div>
      </div>
      <div className="space-y-1 border-t border-blue-200 pt-3 dark:border-blue-500/30">
        <ChangeRow
          current={currentCreator?.valor ?? 0}
          label="Você"
          proposed={userValue}
        />
        {participants.map((participant) => {
          const currentParticipant = current.participantes.find((item) => item.id === participant.key);
          return (
            <ChangeRow
              current={currentParticipant?.valor ?? participant.valor}
              key={participant.key}
              label={participant.nome}
              proposed={participant.valor}
            />
          );
        })}
      </div>
      <p className="text-xs font-bold">
        Escopo: {scope === "EstaOcorrencia" ? `Somente ${month}` : `${month} e próximas`}
      </p>
      <p className="text-xs opacity-80">
        A configuração vigente continuará válida até todos os participantes necessários aceitarem.
      </p>
    </div>
  );
}

function ChangeRow({ current, label, proposed }: { current: number; label: string; proposed: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="font-bold">{formatCurrency(current)} → {formatCurrency(proposed)}</span>
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
  disabled = false,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 ${
        disabled
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
      }`}
    >
      <input
        checked={checked}
        className="h-4 w-4 accent-[var(--app-accent)]"
        disabled={disabled}
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
  return Number.isFinite(value)
    ? new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value)
    : "0";
}

function arredondarDinheiro(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function arredondarPercentual(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function percentualPorValor(valorTotal: number, valorParte: number) {
  if (valorTotal <= 0 || valorParte <= 0) return 0;
  return arredondarPercentual((valorParte / valorTotal) * 100);
}

function calcularParticipantes(
  valorTotal: number,
  usuarios: ParticipanteUsuarioForm[],
  externos: ParticipanteExternoForm[],
) {
  const itens: ParticipanteCalculado[] = [
    ...usuarios.map((participante) => {
      const percentual = parsePercentual(participante.percentual);
      return {
        key: participante.key,
        nome: participante.nome,
        percentual,
        valor: calcularParteNumerica(valorTotal, percentual),
        externo: false,
        status: participante.status,
      };
    }),
    ...externos.map((participante, index) => {
      const valorInformado = participante.modo === "Valor"
        ? parseBrlCurrency(participante.entrada)
        : calcularParteNumerica(valorTotal, parsePercentual(participante.entrada));
      const percentual = participante.modo === "Valor"
        ? percentualPorValor(valorTotal, valorInformado)
        : parsePercentual(participante.entrada);
      return {
        key: participante.key,
        nome: participante.nome.trim() || `Pessoa externa ${index + 1}`,
        percentual,
        valor: arredondarDinheiro(valorInformado),
        externo: true,
        status: participante.status,
      };
    }),
  ];
  return {
    itens,
    somaPercentual: arredondarPercentual(itens.reduce((total, item) => total + item.percentual, 0)),
    somaValor: arredondarDinheiro(itens.reduce((total, item) => total + item.valor, 0)),
    temParteInvalida: itens.some((item) => item.percentual <= 0 || item.valor <= 0),
  };
}

function mapearParticipantesUsuariosRequest(participantes: ParticipanteUsuarioForm[]) {
  return participantes.map((participante) => ({
    email: participante.contatoId ? null : participante.email,
    contatoId: participante.contatoId,
    percentual: parsePercentual(participante.percentual),
    salvarContato: participante.salvarContato,
    apelidoContato: participante.apelidoContato.trim() || null,
  }));
}

function mapearParticipantesExternosRequest(participantes: ParticipanteExternoForm[]) {
  return participantes.map((participante) => ({
    modoDefinicao: participante.modo === "Valor" ? 2 as const : 1 as const,
    percentual: participante.modo === "Percentual" ? parsePercentual(participante.entrada) : null,
    valor: participante.modo === "Valor" ? parseBrlCurrency(participante.entrada) : null,
    nome: participante.nome.trim() || null,
  }));
}

function criarChaveTemporaria() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `participante-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function mensagemDistribuicao(valorTotal: number, soma: number) {
  const diferenca = arredondarDinheiro(valorTotal - soma);
  if (diferenca > 0) return `Falta distribuir ${formatCurrency(diferenca)}.`;
  if (diferenca < 0) return `A distribuição excede o total em ${formatCurrency(Math.abs(diferenca))}.`;
  return "A distribuição deve fechar em 100% e todas as partes precisam ser maiores que zero.";
}

function isParticipanteCriador(participante: DivisaoParticipante) {
  return participante.tipoParticipante === 1 || participante.tipoParticipante === "Criador";
}

function isParticipanteUsuario(participante: DivisaoParticipante) {
  return participante.tipoParticipante === 2 || participante.tipoParticipante === "UsuarioSistema";
}

function isParticipanteExterno(participante: DivisaoParticipante) {
  return participante.tipoParticipante === 3 || participante.tipoParticipante === "Externo";
}

function isModoValor(modo: DivisaoParticipante["modoDefinicao"]) {
  return modo === 2 || modo === "Valor";
}

function isVersaoPendente(versao: DivisaoTransacao["versoes"][number]) {
  return versao.status === 2 || versao.status === "PropostaPendente";
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

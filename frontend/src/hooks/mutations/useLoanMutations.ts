import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as loanService from "../../services/loanService";
import type {
  AtualizarEmprestimoRequest,
  OrigemFinanceiraEmprestimo,
  RegistrarPagamentoEmprestimoRequest,
} from "../../types/loan";
import { OrigemFinanceiraEmprestimo as Origem } from "../../types/loan";
import { queryKeys } from "../queries/queryKeys";

export function useCriarContatoEmprestimo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: loanService.criarContatoEmprestimo,
    onSuccess: (contato) => {
      queryClient.setQueryData(
        queryKeys.contatosEmprestimo,
        (atuais: typeof contato[] | undefined) =>
          atuais ? [...atuais, contato].sort((a, b) => a.nome.localeCompare(b.nome)) : [contato],
      );
    },
  });
}

export function useCriarEmprestimo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: loanService.criarEmprestimo,
    onSuccess: async (emprestimo, request) => {
      queryClient.setQueryData(queryKeys.emprestimo(emprestimo.id), emprestimo);
      await queryClient.invalidateQueries({ queryKey: queryKeys.emprestimosScope });
      await invalidarOrigem(queryClient, request.origemFinanceira);
    },
  });
}

export function useAtualizarEmprestimo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: AtualizarEmprestimoRequest }) =>
      loanService.atualizarEmprestimo(id, request),
    onSuccess: async (emprestimo) => {
      queryClient.setQueryData(queryKeys.emprestimo(emprestimo.id), emprestimo);
      await queryClient.invalidateQueries({ queryKey: queryKeys.emprestimosScope });
    },
  });
}

export function useRegistrarPagamentoEmprestimo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: RegistrarPagamentoEmprestimoRequest }) =>
      loanService.registrarPagamento(id, request),
    onSuccess: async (_pagamento, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.emprestimosScope }),
        queryClient.invalidateQueries({ queryKey: queryKeys.emprestimo(variables.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.contas }),
        queryClient.invalidateQueries({ queryKey: queryKeys.distribuicaoContas }),
      ]);
    },
  });
}

export function useCancelarEmprestimo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; origemFinanceira: OrigemFinanceiraEmprestimo }) =>
      loanService.cancelarEmprestimo(id),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.emprestimosScope }),
        queryClient.invalidateQueries({ queryKey: queryKeys.emprestimo(variables.id) }),
        invalidarOrigem(queryClient, variables.origemFinanceira),
      ]);
    },
  });
}

export function useDesfazerPagamentoEmprestimo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, pagamentoId }: { id: string; pagamentoId: string }) =>
      loanService.desfazerPagamentoEmprestimo(id, pagamentoId),
    onSuccess: async (emprestimo) => {
      queryClient.setQueryData(queryKeys.emprestimo(emprestimo.id), emprestimo);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.emprestimosScope }),
        queryClient.invalidateQueries({ queryKey: queryKeys.contas }),
        queryClient.invalidateQueries({ queryKey: queryKeys.distribuicaoContas }),
      ]);
    },
  });
}

export function useDefinirArquivamentoEmprestimo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, arquivar }: { id: string; arquivar: boolean }) =>
      loanService.definirArquivamentoEmprestimo(id, arquivar),
    onSuccess: async (emprestimo) => {
      queryClient.setQueryData(queryKeys.emprestimo(emprestimo.id), emprestimo);
      await queryClient.invalidateQueries({ queryKey: queryKeys.emprestimosScope });
    },
  });
}

export function useAlterarRecorrenciaEmprestimo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: { competencia: string; valor: number; escopo: 1 | 2 } }) =>
      loanService.alterarRecorrencia(id, request),
    onSuccess: async (emprestimo) => {
      queryClient.setQueryData(queryKeys.emprestimo(emprestimo.id), emprestimo);
      await queryClient.invalidateQueries({ queryKey: queryKeys.emprestimosScope });
    },
  });
}

export function useEncerrarRecorrenciaEmprestimo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ultimaCompetencia }: { id: string; ultimaCompetencia: string }) =>
      loanService.encerrarRecorrencia(id, ultimaCompetencia),
    onSuccess: async (emprestimo) => {
      queryClient.setQueryData(queryKeys.emprestimo(emprestimo.id), emprestimo);
      await queryClient.invalidateQueries({ queryKey: queryKeys.emprestimosScope });
    },
  });
}

async function invalidarOrigem(
  queryClient: ReturnType<typeof useQueryClient>,
  origemFinanceira: OrigemFinanceiraEmprestimo,
) {
  if (origemFinanceira === Origem.CartaoCredito) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.cartoes }),
      queryClient.invalidateQueries({ queryKey: queryKeys.faturasScope }),
    ]);
    return;
  }

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.contas }),
    queryClient.invalidateQueries({ queryKey: queryKeys.distribuicaoContas }),
  ]);
}

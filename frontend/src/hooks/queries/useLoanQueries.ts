import { useQuery } from "@tanstack/react-query";
import { hasUsableStoredAuth } from "../../services/authStorage";
import * as loanService from "../../services/loanService";
import { queryKeys } from "./queryKeys";

export function useEmprestimos(contatoId: string | null, incluirArquivados = false) {
  const canFetch = hasUsableStoredAuth();
  return useQuery({
    queryKey: queryKeys.emprestimos(contatoId, incluirArquivados),
    queryFn: ({ signal }) => loanService.listarEmprestimos(contatoId, incluirArquivados, signal),
    enabled: canFetch,
    staleTime: 2 * 60 * 1000,
  });
}

export function useEmprestimoDetalhe(id: string | null) {
  const canFetch = hasUsableStoredAuth();
  return useQuery({
    queryKey: queryKeys.emprestimo(id ?? ""),
    queryFn: ({ signal }) => loanService.obterEmprestimo(id!, signal),
    enabled: Boolean(id) && canFetch,
  });
}

export function useContatosEmprestimo() {
  const canFetch = hasUsableStoredAuth();
  return useQuery({
    queryKey: queryKeys.contatosEmprestimo,
    queryFn: ({ signal }) => loanService.listarContatosEmprestimo(signal),
    enabled: canFetch,
    staleTime: 15 * 60 * 1000,
  });
}

import { api } from "./api";
import type {
  AtualizarEmprestimoRequest,
  ContatoEmprestimo,
  CriarEmprestimoRequest,
  EmprestimoDetalhe,
  EmprestimoResumo,
  PagamentoEmprestimo,
  RegistrarPagamentoEmprestimoRequest,
} from "../types/loan";

export async function listarEmprestimos(
  contatoId?: string | null,
  incluirArquivados = false,
  signal?: AbortSignal,
) {
  const { data } = await api.get<EmprestimoResumo[]>("/api/emprestimos", {
    params: {
      ...(contatoId ? { contatoId } : {}),
      ...(incluirArquivados ? { incluirArquivados: true } : {}),
    },
    signal,
  });
  return data;
}

export async function obterEmprestimo(id: string, signal?: AbortSignal) {
  const { data } = await api.get<EmprestimoDetalhe>(`/api/emprestimos/${id}`, {
    signal,
  });
  return data;
}

export async function criarEmprestimo(request: CriarEmprestimoRequest) {
  const { data } = await api.post<EmprestimoDetalhe>("/api/emprestimos", request);
  return data;
}

export async function atualizarEmprestimo(
  id: string,
  request: AtualizarEmprestimoRequest,
) {
  const { data } = await api.patch<EmprestimoDetalhe>(
    `/api/emprestimos/${id}`,
    request,
  );
  return data;
}

export async function registrarPagamento(
  id: string,
  request: RegistrarPagamentoEmprestimoRequest,
) {
  const { data } = await api.post<PagamentoEmprestimo>(
    `/api/emprestimos/${id}/pagamentos`,
    request,
  );
  return data;
}

export async function cancelarEmprestimo(id: string) {
  await api.delete(`/api/emprestimos/${id}`);
}

export async function desfazerPagamentoEmprestimo(id: string, pagamentoId: string) {
  const { data } = await api.delete<EmprestimoDetalhe>(
    `/api/emprestimos/${id}/pagamentos/${pagamentoId}`,
  );
  return data;
}

export async function definirArquivamentoEmprestimo(id: string, arquivar: boolean) {
  const acao = arquivar ? "arquivar" : "desarquivar";
  const { data } = await api.patch<EmprestimoDetalhe>(
    `/api/emprestimos/${id}/${acao}`,
  );
  return data;
}

export async function listarContatosEmprestimo(signal?: AbortSignal) {
  const { data } = await api.get<ContatoEmprestimo[]>("/api/emprestimos/contatos", {
    signal,
  });
  return data;
}

export async function criarContatoEmprestimo(request: {
  nome: string;
  observacao?: string | null;
}) {
  const { data } = await api.post<ContatoEmprestimo>(
    "/api/emprestimos/contatos",
    request,
  );
  return data;
}

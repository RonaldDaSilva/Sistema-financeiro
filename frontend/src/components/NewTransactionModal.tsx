import { X } from "lucide-react";
import { TransactionForm } from "./TransactionForm";
import type {
  CartaoCredito,
  CartaoCreditoOpcao,
  Categoria,
  ContaBancaria,
  CriarCompraParceladaRequest,
  CriarTransacaoRequest,
  ExtratoMensalItem,
} from "../types/finance";

type NewTransactionModalProps = {
  isOpen: boolean;
  categorias: Categoria[];
  cartoes: Array<CartaoCredito | CartaoCreditoOpcao>;
  contas: ContaBancaria[];
  percentualPadraoDivisao: number;
  initialTransaction?: ExtratoMensalItem | null;
  onClose: () => void;
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

export function NewTransactionModal({
  isOpen,
  categorias,
  cartoes,
  contas,
  percentualPadraoDivisao,
  initialTransaction,
  onClose,
  onCreateTransacao,
  onUpdateTransacao,
  onUpdateCompraParcelada,
  onCreateCompraParcelada,
}: NewTransactionModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg">
        <button
          className="absolute right-4 top-4 z-10 rounded-full bg-white p-2 text-slate-400 shadow-sm transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--app-primary)] dark:bg-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
          type="button"
          onClick={onClose}
          aria-label="Fechar modal"
        >
          <X size={20} />
        </button>
        <TransactionForm
          variant="modal"
          categorias={categorias}
          cartoes={cartoes}
          contas={contas}
          percentualPadraoDivisao={percentualPadraoDivisao}
          initialTransaction={initialTransaction}
          onCancel={onClose}
          onCreateTransacao={onCreateTransacao}
          onUpdateTransacao={onUpdateTransacao}
          onUpdateCompraParcelada={onUpdateCompraParcelada}
          onCreateCompraParcelada={onCreateCompraParcelada}
        />
      </div>
    </div>
  );
}

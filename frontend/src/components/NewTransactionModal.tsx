import { TransactionForm } from "./TransactionForm";
import { Dialog } from "./Dialog";
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
    <Dialog
      title={initialTransaction ? "Editar transação" : "Adicionar nova transação"}
      description="Adicione os detalhes da movimentação."
      className="flex h-[calc(100dvh-1rem)] max-w-lg flex-col overflow-hidden sm:h-auto sm:max-h-[calc(100dvh-2rem)]"
      onClose={onClose}
    >
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
    </Dialog>
  );
}

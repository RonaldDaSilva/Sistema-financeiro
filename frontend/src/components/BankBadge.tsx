import { Landmark } from "lucide-react";
import { bancosPorCodigo } from "../constants/banks";

type BankBadgeProps = {
  codigoBanco: string;
  size?: "sm" | "md";
};

export function BankBadge({ codigoBanco, size = "md" }: BankBadgeProps) {
  const banco = bancosPorCodigo[codigoBanco];
  const dimensions = size === "sm" ? "h-9 w-9 text-[10px]" : "h-12 w-12 text-xs";

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-xl font-black text-white shadow-sm ${dimensions}`}
      style={{ backgroundColor: banco?.cor ?? "#475569" }}
      title={banco?.nome ?? `Banco ${codigoBanco}`}
    >
      {banco?.sigla ?? <Landmark size={size === "sm" ? 17 : 21} />}
    </span>
  );
}

export type BancoCompe = {
  codigo: string;
  nome: string;
  sigla: string;
  cor: string;
};

export const principaisBancos: BancoCompe[] = [
  { codigo: "001", nome: "Banco do Brasil", sigla: "BB", cor: "#F9DD16" },
  { codigo: "003", nome: "Banco da Amazônia", sigla: "BASA", cor: "#008C4A" },
  { codigo: "004", nome: "Banco do Nordeste", sigla: "BNB", cor: "#E86A25" },
  { codigo: "021", nome: "Banestes", sigla: "BE", cor: "#0069A7" },
  { codigo: "033", nome: "Santander", sigla: "SAN", cor: "#EC0000" },
  { codigo: "041", nome: "Banrisul", sigla: "BR", cor: "#005CA9" },
  { codigo: "070", nome: "BRB", sigla: "BRB", cor: "#009EDB" },
  { codigo: "077", nome: "Banco Inter", sigla: "INTER", cor: "#FF7A00" },
  { codigo: "104", nome: "Caixa Econômica Federal", sigla: "CEF", cor: "#0066A6" },
  { codigo: "121", nome: "Agibank", sigla: "AGI", cor: "#00AEEF" },
  { codigo: "208", nome: "BTG Pactual", sigla: "BTG", cor: "#172B4D" },
  { codigo: "212", nome: "Banco Original", sigla: "ORI", cor: "#00A443" },
  { codigo: "237", nome: "Bradesco", sigla: "BRA", cor: "#CC092F" },
  { codigo: "260", nome: "Nubank", sigla: "NU", cor: "#820AD1" },
  { codigo: "290", nome: "PagBank", sigla: "PAG", cor: "#00A868" },
  { codigo: "323", nome: "Mercado Pago", sigla: "MP", cor: "#00B1EA" },
  { codigo: "336", nome: "C6 Bank", sigla: "C6", cor: "#242424" },
  { codigo: "341", nome: "Itaú Unibanco", sigla: "ITAÚ", cor: "#EC7000" },
  { codigo: "380", nome: "PicPay", sigla: "PIC", cor: "#21C25E" },
  { codigo: "422", nome: "Banco Safra", sigla: "SAF", cor: "#1B3764" },
  { codigo: "623", nome: "Banco Pan", sigla: "PAN", cor: "#00AEEF" },
  { codigo: "633", nome: "Banco Rendimento", sigla: "REN", cor: "#005596" },
  { codigo: "655", nome: "Banco Votorantim", sigla: "BV", cor: "#2446D8" },
  { codigo: "707", nome: "Banco Daycoval", sigla: "DAY", cor: "#0055A5" },
  { codigo: "756", nome: "Sicoob", sigla: "SICOOB", cor: "#003641" },
];

export const bancosPorCodigo = Object.fromEntries(
  principaisBancos.map((banco) => [banco.codigo, banco]),
) as Record<string, BancoCompe>;

export type AuthResponse = {
  usuarioId: string;
  nome: string;
  email: string;
  telefone?: string | null;
  cpf?: string | null;
  accessToken: string;
  accessTokenExpiraEm: string;
  refreshToken: string;
  refreshTokenExpiraEm: string;
  lastActivityAt?: string;
};

export type AuthSession = AuthResponse;

export type LoginRequest = {
  email: string;
  senha: string;
};

export type RegisterRequest = {
  nome: string;
  email: string;
  senha: string;
  telefone?: string;
  cpf?: string;
};

export type AuthUser = {
  id: string;
  nome: string;
  email: string;
  telefone?: string | null;
  cpf?: string | null;
};

export type UserProfile = {
  id: string;
  nome: string;
  email: string;
  telefone?: string | null;
  cpf?: string | null;
};

export type UpdateProfileRequest = {
  nome: string;
  email?: string;
  telefone?: string | null;
  cpf?: string | null;
  confirmarAlteracao: boolean;
};

export type ChangePasswordRequest = {
  senhaAtual: string;
  novaSenha: string;
  confirmarAlteracao: boolean;
};

export type DeleteAccountRequest = {
  senha: string;
  confirmacao: string;
};

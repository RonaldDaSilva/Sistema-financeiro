import { FormEvent, useState } from 'react';
import axios from 'axios';
import { Eye, EyeOff, IdCard, LockKeyhole, Mail, Phone, User, WalletCards } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { maskCpf } from '../utils/cpf';

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setErro(null);
    const nomeNormalizado = nome.trim();
    const emailNormalizado = email.trim().toLowerCase();

    if (!nomeNormalizado || !emailNormalizado || senha.length < 8) {
      setErro('Informe nome, e-mail e uma senha com pelo menos 8 caracteres.');
      return;
    }

    setIsSubmitting(true);

    try {
      await register({
        nome: nomeNormalizado,
        email: emailNormalizado,
        telefone: telefone || undefined,
        cpf: cpf || undefined,
        senha,
      });
      navigate('/', { replace: true });
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response) {
        setErro('Não foi possível conectar ao backend local. Verifique se a API está rodando em http://localhost:5000.');
        return;
      }

      setErro(extractMessage(error, 'Não foi possível criar sua conta.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#eef7f4] px-4 py-8 text-slate-950">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-emerald-200/60 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-sky-200/50 blur-3xl" />
      </div>

      <section className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-2xl flex-col items-center justify-center">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-100 text-emerald-600 shadow-[0_18px_45px_rgba(16,185,129,0.22)]">
            <WalletCards size={34} strokeWidth={2.2} />
          </div>
          <h1 className="text-4xl font-black tracking-normal text-slate-950 sm:text-5xl">
            Crie sua conta
          </h1>
          <p className="mt-3 text-base font-medium text-slate-500">
            Organize suas finanças com segurança
          </p>
        </div>

        <form
          className="w-full rounded-[1.75rem] border border-white/80 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.14)] backdrop-blur sm:p-8"
          onSubmit={handleSubmit}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-sm font-bold text-slate-700">Nome</span>
              <span className="mt-2 flex h-14 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-500 transition focus-within:border-emerald-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-100">
                <User size={22} strokeWidth={2} />
                <input
                  className="h-full min-w-0 flex-1 bg-transparent text-base font-medium text-slate-900 outline-none placeholder:text-slate-400"
                  placeholder="Seu nome completo"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  autoComplete="name"
                  required
                />
              </span>
            </label>

            <label className="block sm:col-span-2">
              <span className="text-sm font-bold text-slate-700">E-mail</span>
              <span className="mt-2 flex h-14 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-500 transition focus-within:border-emerald-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-100">
                <Mail size={22} strokeWidth={2} />
                <input
                  className="h-full min-w-0 flex-1 bg-transparent text-base font-medium text-slate-900 outline-none placeholder:text-slate-400"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </span>
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">Telefone</span>
              <span className="mt-2 flex h-14 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-500 transition focus-within:border-emerald-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-100">
                <Phone size={22} strokeWidth={2} />
                <input
                  className="h-full min-w-0 flex-1 bg-transparent text-base font-medium text-slate-900 outline-none placeholder:text-slate-400"
                  inputMode="numeric"
                  placeholder="(11) 99999-9999"
                  value={telefone}
                  onChange={(event) => setTelefone(maskPhone(event.target.value))}
                  autoComplete="tel"
                />
              </span>
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">CPF</span>
              <span className="mt-2 flex h-14 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-500 transition focus-within:border-emerald-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-100">
                <IdCard size={22} strokeWidth={2} />
                <input
                  className="h-full min-w-0 flex-1 bg-transparent text-base font-medium text-slate-900 outline-none placeholder:text-slate-400"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(event) => setCpf(maskCpf(event.target.value))}
                  autoComplete="off"
                />
              </span>
            </label>

            <label className="block sm:col-span-2">
              <span className="text-sm font-bold text-slate-700">Senha</span>
              <span className="mt-2 flex h-14 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-500 transition focus-within:border-emerald-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-100">
                <LockKeyhole size={22} strokeWidth={2} />
                <input
                  className="h-full min-w-0 flex-1 bg-transparent text-base font-medium text-slate-900 outline-none placeholder:text-slate-400"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Crie uma senha com no minimo 8 caracteres"
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <button
                  aria-label={showPassword ? 'Ocultar senha' : 'Visualizar senha'}
                  className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff size={21} /> : <Eye size={21} />}
                </button>
              </span>
            </label>
          </div>

          {erro && (
            <p className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600" role="alert">
              {erro}
            </p>
          )}

          <button
            className="mt-7 h-14 w-full rounded-xl bg-emerald-600 px-4 text-base font-black text-white shadow-[0_18px_34px_rgba(5,150,105,0.25)] transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Criando...' : 'Criar cadastro'}
          </button>

          <p className="mt-7 text-center text-sm font-medium text-slate-500">
            Ja tem conta?{' '}
            <Link className="font-black text-emerald-600 transition hover:text-emerald-700" to="/login">
              Entrar
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}

function extractMessage(error: unknown, fallback: string) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'data' in error.response &&
    typeof error.response.data === 'object' &&
    error.response.data !== null &&
    'message' in error.response.data &&
    typeof error.response.data.message === 'string'
  ) {
    return error.response.data.message;
  }

  return fallback;
}


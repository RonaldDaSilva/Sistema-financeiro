import { FormEvent, useState } from "react";
import axios from "axios";
import { Eye, EyeOff, LockKeyhole, Mail, WalletCards } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/useAuth";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setErro(null);
    const emailNormalizado = email.trim().toLowerCase();

    if (!emailNormalizado || !senha) {
      setErro("Informe e-mail e senha.");
      return;
    }

    setIsSubmitting(true);

    try {
      await login({ email: emailNormalizado, senha });
      const redirectParam = new URLSearchParams(location.search).get("redirect");
      const redirectTo = redirectParam || location.state?.from?.pathname || "/";
      navigate(redirectTo, { replace: true });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setErro("E-mail ou senha inválidos.");
        return;
      }

      if (axios.isAxiosError(error) && !error.response) {
        setErro("Não foi possível conectar ao backend local. Verifique se a API está rodando em http://localhost:5000.");
        return;
      }

      setErro("Não foi possível entrar agora. Tente novamente em instantes.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#eef7f4] px-4 py-10 text-slate-950">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-emerald-200/60 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-sky-200/50 blur-3xl" />
      </div>

      <section className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-xl flex-col items-center justify-center">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-100 text-emerald-600 shadow-[0_18px_45px_rgba(16,185,129,0.22)]">
            <WalletCards size={34} strokeWidth={2.2} />
          </div>
          <h1 className="text-4xl font-black tracking-normal text-slate-950 sm:text-5xl">
            Bem-vindo de volta
          </h1>
          <p className="mt-3 text-base font-medium text-slate-500">
            Entre no seu sistema financeiro
          </p>
        </div>

        <form
          className="w-full rounded-[1.75rem] border border-white/80 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.14)] backdrop-blur sm:p-8"
          onSubmit={handleSubmit}
        >
          <div className="space-y-6">
            <label className="block">
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
              <span className="text-sm font-bold text-slate-700">Senha</span>
              <span className="mt-2 flex h-14 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-500 transition focus-within:border-emerald-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-100">
                <LockKeyhole size={22} strokeWidth={2} />
                <input
                  className="h-full min-w-0 flex-1 bg-transparent text-base font-medium text-slate-900 outline-none placeholder:text-slate-400"
                  type={showPassword ? "text" : "password"}
                  placeholder="Digite sua senha"
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  aria-label={
                    showPassword ? "Ocultar senha" : "Visualizar senha"
                  }
                  className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff size={21} /> : <Eye size={21} />}
                </button>
              </span>
            </label>
          </div>

          {/* <div className="mt-4 flex justify-end">
            <button
              className="text-sm font-bold text-emerald-600 transition hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              type="button"
            >
              Esqueceu a senha?
            </button>
          </div> */}

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
            {isSubmitting ? "Entrando..." : "Entrar"}
          </button>

          <p className="mt-7 text-center text-sm font-medium text-slate-500">
            Ainda nao tem conta?{" "}
            <Link
              className="font-black text-emerald-600 transition hover:text-emerald-700"
              to="/cadastro"
            >
              Criar cadastro
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}


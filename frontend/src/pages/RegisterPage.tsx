import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { maskCpf } from '../utils/cpf';

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setIsSubmitting(true);

    try {
      await register({
        nome,
        email,
        telefone: telefone || undefined,
        cpf: cpf || undefined,
        senha,
      });
      navigate('/', { replace: true });
    } catch {
      setErro('Nao foi possivel criar sua conta.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form className="w-full max-w-sm rounded-lg bg-[var(--app-card)] p-6 shadow-sm dark:bg-slate-900" onSubmit={handleSubmit}>
        <h1 className="text-2xl font-semibold text-slate-900">Criar conta</h1>
        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Nome</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">E-mail</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Telefone</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
              value={telefone}
              onChange={(event) => setTelefone(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">CPF</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(event) => setCpf(maskCpf(event.target.value))}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Senha</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
              type="password"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              minLength={8}
              required
            />
          </label>
        </div>
        {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}
        <button
          className="mt-6 w-full rounded-md bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-60"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Criando...' : 'Criar conta'}
        </button>
        <p className="mt-4 text-center text-sm text-slate-600">
          Ja tem conta?{' '}
          <Link className="font-medium text-slate-900" to="/login">
            Entrar
          </Link>
        </p>
      </form>
    </main>
  );
}

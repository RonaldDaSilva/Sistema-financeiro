import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthResponse, AuthSession } from '../types/auth';
import { getStoredAuth, setStoredAuth } from './authStorage';
import { refreshSessionCoordinated } from './authRefreshCoordinator';

const refreshLockKey = 'sistema_financeiro_auth_refresh_lock';

describe('authRefreshCoordinator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-28T12:00:00.000Z'));
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('renova access expirado e grava a sessão rotacionada', async () => {
    setStoredAuth(createSession({
      accessToken: 'access-antigo',
      accessTokenExpiraEm: '2026-07-28T11:59:00.000Z',
      refreshToken: 'refresh-antigo',
    }));
    const refreshFn = vi.fn().mockResolvedValue(createSession({
      accessToken: 'access-novo',
      refreshToken: 'refresh-novo',
      accessTokenExpiraEm: '2026-07-28T12:15:00.000Z',
    }));

    const session = await refreshSessionCoordinated(refreshFn);

    expect(refreshFn).toHaveBeenCalledTimes(1);
    expect(refreshFn).toHaveBeenCalledWith('refresh-antigo');
    expect(session?.accessToken).toBe('access-novo');
    expect(getStoredAuth()?.refreshToken).toBe('refresh-novo');
  });

  it('aguarda outra aba e nao reutiliza refresh antigo quando storage ja foi atualizado', async () => {
    setStoredAuth(createSession({
      accessToken: 'access-antigo',
      accessTokenExpiraEm: '2026-07-28T11:59:00.000Z',
      refreshToken: 'refresh-antigo',
    }));
    localStorage.setItem(
      refreshLockKey,
      JSON.stringify({ ownerId: 'outra-aba', expiresAt: Date.now() + 5_000 }),
    );
    const refreshFn = vi.fn();

    const promise = refreshSessionCoordinated(refreshFn);
    await vi.advanceTimersByTimeAsync(100);

    setStoredAuth(createSession({
      accessToken: 'access-novo',
      refreshToken: 'refresh-novo',
      accessTokenExpiraEm: '2026-07-28T12:15:00.000Z',
    }));
    localStorage.removeItem(refreshLockKey);
    await vi.advanceTimersByTimeAsync(100);

    const session = await promise;

    expect(refreshFn).not.toHaveBeenCalled();
    expect(session?.refreshToken).toBe('refresh-novo');
  });

  it('limpa sessão quando refresh e rejeitado pelo servidor', async () => {
    setStoredAuth(createSession({
      accessTokenExpiraEm: '2026-07-28T11:59:00.000Z',
    }));

    const session = await refreshSessionCoordinated(
      vi.fn().mockRejectedValue(new Error('401')),
    );

    expect(session).toBeNull();
    expect(getStoredAuth()).toBeNull();
  });
});

function createSession(overrides: Partial<AuthSession> = {}): AuthResponse {
  return {
    usuarioId: 'user-1',
    nome: 'Ronald',
    email: 'ronald@example.com',
    accessToken: 'access-token',
    accessTokenExpiraEm: '2026-07-28T12:15:00.000Z',
    refreshToken: 'refresh-token',
    refreshTokenExpiraEm: '2026-08-27T12:00:00.000Z',
    sessaoExpiraEm: '2026-09-26T12:00:00.000Z',
    ultimaAtividadeEm: '2026-07-28T12:00:00.000Z',
    ...overrides,
  };
}

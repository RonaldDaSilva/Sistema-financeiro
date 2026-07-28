import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthSession } from '../types/auth';
import { getStoredAuth, setStoredAuth } from './authStorage';

describe('authStorage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-28T12:00:00.000Z'));
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('mantem sessão restaurável após 13 horas quando refresh e sessão absoluta continuam válidos', () => {
    const session = createSession({
      accessTokenExpiraEm: '2026-07-28T00:15:00.000Z',
      refreshTokenExpiraEm: '2026-08-27T00:00:00.000Z',
      sessaoExpiraEm: '2026-09-26T00:00:00.000Z',
      ultimaAtividadeEm: '2026-07-27T23:00:00.000Z',
      lastActivityAt: '2026-07-27T23:00:00.000Z',
    });

    setStoredAuth(session);

    expect(getStoredAuth()?.refreshToken).toBe('refresh-token');
  });

  it('limpa sessão quando validade absoluta expirou', () => {
    setStoredAuth(createSession({
      refreshTokenExpiraEm: '2026-08-27T00:00:00.000Z',
      sessaoExpiraEm: '2026-07-28T11:59:59.000Z',
    }));

    expect(getStoredAuth()).toBeNull();
  });

  it('limpa sessão quando janela de refresh expirou', () => {
    setStoredAuth(createSession({
      refreshTokenExpiraEm: '2026-07-28T11:59:59.000Z',
      sessaoExpiraEm: '2026-09-26T00:00:00.000Z',
    }));

    expect(getStoredAuth()).toBeNull();
  });
});

function createSession(overrides: Partial<AuthSession> = {}): AuthSession {
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

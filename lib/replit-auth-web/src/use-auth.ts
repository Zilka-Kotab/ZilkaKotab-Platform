import { createElement, Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface AuthUser {
  id: string;
  tenantId: string;
  objectId: string;
  email: string | null;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

function getBasePath() {
  const meta = import.meta as any;
  return (meta?.env?.BASE_URL?.replace(/\/+$/, '') || '/');
}

function useAuthState(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/auth/user', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ user: AuthUser | null }>;
      })
      .then((data) => {
        if (!cancelled) {
          setUser(data.user ?? null);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(() => {
    const base = getBasePath();
    const returnTo = base === '/' ? '/portal' : `${base}/portal`;
    window.location.href = `/api/auth/microsoft/login?returnTo=${encodeURIComponent(returnTo)}`;
  }, []);

  const logout = useCallback(() => {
    const base = getBasePath();
    window.location.href = `/api/auth/logout?returnTo=${encodeURIComponent(base || '/')}`;
  }, []);

  return useMemo(() => ({
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
  }), [user, isLoading, login, logout]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return createElement(Fragment, null, children);
}

export function useAuth(): AuthState {
  return useAuthState();
}
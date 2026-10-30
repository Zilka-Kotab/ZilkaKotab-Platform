import { createElement, Fragment, useCallback, useMemo, type ReactNode } from 'react';
import { useClerk, useUser } from '@clerk/react';

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
}

/** Compatibility adapter for existing portal consumers; Clerk owns the session. */
export function useAuth() {
  const { user: identity, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const meta = import.meta as ImportMeta & { env?: { BASE_URL?: string } };
  const base = (meta.env?.BASE_URL || '/').replace(/\/+$/, '');
  const login = useCallback(() => window.location.assign(`${base}/sign-in`), [base]);
  const logout = useCallback(() => { void signOut({ redirectUrl: `${base}/` }); }, [base, signOut]);
  const user = useMemo<AuthUser | null>(() => identity ? {
    id: identity.id, email: identity.primaryEmailAddress?.emailAddress ?? null,
    displayName: identity.fullName || identity.primaryEmailAddress?.emailAddress || null,
    firstName: identity.firstName, lastName: identity.lastName,
  } : null, [identity]);
  return { user, isLoading: !isLoaded, isAuthenticated: !!isSignedIn, login, logout };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return createElement(Fragment, null, children);
}

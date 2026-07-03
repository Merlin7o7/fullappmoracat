"use client";

import * as React from "react";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const STORAGE_KEY = "moraqat.auth";

export interface AuthUser {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  locale?: string;
  status?: string;
  isStaff?: boolean;
}

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  user: AuthUser | null;
  tokens: Tokens | null;
  ready: boolean; // hydrated from storage
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string, totp?: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  /** Authenticated fetch against the API that refreshes on 401. */
  authedFetch: <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
}

interface RegisterInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const message = Array.isArray(json?.message) ? json.message.join(", ") : json?.message;
    throw new Error(message || `Request failed (${res.status})`);
  }
  return json as T;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>({ user: null, tokens: null, ready: false });
  const tokensRef = React.useRef<Tokens | null>(null);

  const persist = React.useCallback((user: AuthUser | null, tokens: Tokens | null) => {
    tokensRef.current = tokens;
    setState({ user, tokens, ready: true });
    if (typeof window !== "undefined") {
      if (user && tokens) localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, tokens }));
      else localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Hydrate from storage on mount.
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { user: AuthUser; tokens: Tokens };
        tokensRef.current = parsed.tokens;
        setState({ user: parsed.user, tokens: parsed.tokens, ready: true });
        return;
      }
    } catch {
      /* ignore corrupt storage */
    }
    setState((s) => ({ ...s, ready: true }));
  }, []);

  const login = React.useCallback<AuthContextValue["login"]>(
    async (email, password, totp) => {
      const data = await apiPost<{ user: AuthUser; accessToken: string; refreshToken: string }>(
        "/auth/login",
        { email, password, ...(totp ? { totp } : {}) }
      );
      persist(data.user, { accessToken: data.accessToken, refreshToken: data.refreshToken });
    },
    [persist]
  );

  const register = React.useCallback<AuthContextValue["register"]>(
    async (input) => {
      const data = await apiPost<{ user: AuthUser; accessToken: string; refreshToken: string }>(
        "/auth/register",
        input
      );
      persist(data.user, { accessToken: data.accessToken, refreshToken: data.refreshToken });
    },
    [persist]
  );

  const logout = React.useCallback<AuthContextValue["logout"]>(async () => {
    const refreshToken = tokensRef.current?.refreshToken;
    if (refreshToken) {
      await apiPost("/auth/logout", { refreshToken }).catch(() => {});
    }
    persist(null, null);
  }, [persist]);

  const authedFetch = React.useCallback<AuthContextValue["authedFetch"]>(
    async (path, init = {}) => {
      const doFetch = (token: string) =>
        fetch(`${BASE}/api${path}`, {
          ...init,
          headers: {
            "content-type": "application/json",
            ...(init.headers ?? {}),
            authorization: `Bearer ${token}`,
          },
        });

      let tokens = tokensRef.current;
      if (!tokens) throw new Error("Not authenticated");

      let res = await doFetch(tokens.accessToken);

      // Access expired → try one refresh + retry.
      if (res.status === 401) {
        try {
          const refreshed = await apiPost<{ accessToken: string; refreshToken: string }>(
            "/auth/refresh",
            { refreshToken: tokens.refreshToken }
          );
          const next = { accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken };
          persist(state.user, next);
          res = await doFetch(next.accessToken);
        } catch {
          persist(null, null);
          throw new Error("Session expired");
        }
      }

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const message = Array.isArray(json?.message) ? json.message.join(", ") : json?.message;
        throw new Error(message || `Request failed (${res.status})`);
      }
      return json as never;
    },
    [persist, state.user]
  );

  const value = React.useMemo<AuthContextValue>(
    () => ({ ...state, login, register, logout, authedFetch }),
    [state, login, register, logout, authedFetch]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

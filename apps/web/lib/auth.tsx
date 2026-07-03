"use client";

import * as React from "react";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const STORAGE_KEY = "moraqat.auth";

export type Gender = "MALE" | "FEMALE" | "UNSPECIFIED";

export interface AuthUser {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  dialCode?: string | null;
  gender?: Gender;
  avatarUrl?: string | null;
  primaryCatId?: string | null;
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

export interface RegisterInput {
  email: string;
  password?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  dialCode?: string;
  gender?: Gender;
  acceptTerms: boolean;
  otp?: string;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string, opts?: { totp?: string; rememberMe?: boolean }) => Promise<void>;
  loginWithPhone: (phone: string, otp: string, rememberMe?: boolean) => Promise<void>;
  loginWithGoogle: (idToken: string, rememberMe?: boolean) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  requestOtp: (phone: string, purpose?: "LOGIN" | "REGISTER") => Promise<{ devCode?: string }>;
  forgotPassword: (email: string) => Promise<{ devToken?: string }>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Patch the cached user (e.g. after changing the primary cat). */
  updateUser: (patch: Partial<AuthUser>) => void;
  /** Authenticated fetch against the API that refreshes on 401. */
  authedFetch: <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
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

type AuthResponse = { user: AuthUser; accessToken: string; refreshToken: string };

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
    async (email, password, opts) => {
      const data = await apiPost<AuthResponse>("/auth/login", {
        email,
        password,
        ...(opts?.totp ? { totp: opts.totp } : {}),
        ...(opts?.rememberMe ? { rememberMe: true } : {}),
      });
      persist(data.user, { accessToken: data.accessToken, refreshToken: data.refreshToken });
    },
    [persist]
  );

  const loginWithPhone = React.useCallback<AuthContextValue["loginWithPhone"]>(
    async (phone, otp, rememberMe) => {
      const data = await apiPost<AuthResponse>("/auth/otp/login", { phone, otp, rememberMe });
      persist(data.user, { accessToken: data.accessToken, refreshToken: data.refreshToken });
    },
    [persist]
  );

  const loginWithGoogle = React.useCallback<AuthContextValue["loginWithGoogle"]>(
    async (idToken, rememberMe) => {
      const data = await apiPost<AuthResponse>("/auth/google", { idToken, rememberMe });
      persist(data.user, { accessToken: data.accessToken, refreshToken: data.refreshToken });
    },
    [persist]
  );

  const register = React.useCallback<AuthContextValue["register"]>(
    async (input) => {
      const data = await apiPost<AuthResponse>("/auth/register", input);
      persist(data.user, { accessToken: data.accessToken, refreshToken: data.refreshToken });
    },
    [persist]
  );

  const requestOtp = React.useCallback<AuthContextValue["requestOtp"]>(async (phone, purpose = "LOGIN") => {
    return apiPost<{ devCode?: string }>("/auth/otp/request", { phone, purpose });
  }, []);

  const forgotPassword = React.useCallback<AuthContextValue["forgotPassword"]>(async (email) => {
    return apiPost<{ devToken?: string }>("/auth/password/forgot", { email });
  }, []);

  const resetPassword = React.useCallback<AuthContextValue["resetPassword"]>(async (token, newPassword) => {
    await apiPost("/auth/password/reset", { token, newPassword });
  }, []);

  const logout = React.useCallback<AuthContextValue["logout"]>(async () => {
    const refreshToken = tokensRef.current?.refreshToken;
    if (refreshToken) {
      await apiPost("/auth/logout", { refreshToken }).catch(() => {});
    }
    persist(null, null);
  }, [persist]);

  const updateUser = React.useCallback<AuthContextValue["updateUser"]>((patch) => {
    setState((s) => {
      if (!s.user) return s;
      const nextUser = { ...s.user, ...patch };
      if (typeof window !== "undefined" && s.tokens) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: nextUser, tokens: s.tokens }));
      }
      return { ...s, user: nextUser };
    });
  }, []);

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

      const tokens = tokensRef.current;
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
    () => ({
      ...state,
      login,
      loginWithPhone,
      loginWithGoogle,
      register,
      requestOtp,
      forgotPassword,
      resetPassword,
      logout,
      updateUser,
      authedFetch,
    }),
    [state, login, loginWithPhone, loginWithGoogle, register, requestOtp, forgotPassword, resetPassword, logout, updateUser, authedFetch]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

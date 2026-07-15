"use client";

import * as React from "react";
import { fetchWithTimeout, httpError, ApiError, friendly } from "./http";
import { clearAllCachedCats } from "./offline";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const STORAGE_KEY = "moraqat.auth";
// Image/file uploads get a longer ceiling than JSON calls (mobile data), but
// must still terminate rather than hang forever.
const UPLOAD_TIMEOUT_MS = 30_000;

export type Gender = "MALE" | "FEMALE" | "UNSPECIFIED";

export interface AuthUser {
  id: string;
  memberIdNumber?: string | null;
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
  emailVerified?: boolean;
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
  /** Referral code from ?ref= — attributes the signup to the inviting member. */
  ref?: string;
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
  /** Authenticated download — returns the raw response Blob (e.g. CSV export). */
  authedBlob: (path: string) => Promise<Blob>;
  /** Multipart upload (FormData) with the same token-attach + refresh flow. */
  authedUpload: <T = unknown>(path: string, form: FormData, method?: string) => Promise<T>;
  /** Image upload via XHR with real upload-progress events (0–100). */
  uploadImage: <T = unknown>(
    path: string,
    blob: Blob,
    opts?: { onProgress?: (pct: number) => void; filename?: string }
  ) => Promise<T>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithTimeout(`${BASE}/api${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw httpError(res.status, json);
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
      if (user && tokens) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, tokens }));
        // Non-secret presence flag the edge middleware reads to gate /portal &
        // /admin shells (the tokens themselves stay in localStorage). Persisted
        // to match the localStorage session's lifetime, so a returning member
        // isn't bounced to /login on a hard nav after a browser restart.
        document.cookie = `mrc_auth=1; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
      } else {
        localStorage.removeItem(STORAGE_KEY);
        document.cookie = "mrc_auth=; path=/; max-age=0; SameSite=Lax";
      }
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
        // Re-assert the middleware presence cookie in case it was cleared while
        // the localStorage session persists (belt-and-suspenders with the
        // persistent cookie set in persist()).
        document.cookie = `mrc_auth=1; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
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
    // Leave nothing behind on a shared device — the offline Cat ID cache is
    // cleared alongside the session tokens.
    clearAllCachedCats();
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
        fetchWithTimeout(`${BASE}/api${path}`, {
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
        } catch (err) {
          // A timeout/network blip on refresh must NOT nuke the session — only a
          // genuine auth rejection should. Surface transient failures for retry.
          if (err instanceof ApiError && (err.kind === "timeout" || err.kind === "network")) throw err;
          persist(null, null);
          throw new Error("Session expired");
        }
      }

      const json = await res.json().catch(() => null);
      if (!res.ok) throw httpError(res.status, json);
      return json as never;
    },
    [persist, state.user]
  );

  const authedBlob = React.useCallback<AuthContextValue["authedBlob"]>(
    async (path) => {
      const doFetch = (token: string) =>
        fetchWithTimeout(`${BASE}/api${path}`, { headers: { authorization: `Bearer ${token}` } });

      const tokens = tokensRef.current;
      if (!tokens) throw new Error("Not authenticated");

      let res = await doFetch(tokens.accessToken);
      if (res.status === 401) {
        try {
          const refreshed = await apiPost<{ accessToken: string; refreshToken: string }>(
            "/auth/refresh",
            { refreshToken: tokens.refreshToken }
          );
          const next = { accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken };
          persist(state.user, next);
          res = await doFetch(next.accessToken);
        } catch (err) {
          if (err instanceof ApiError && (err.kind === "timeout" || err.kind === "network")) throw err;
          persist(null, null);
          throw new Error("Session expired");
        }
      }
      if (!res.ok) throw httpError(res.status, await res.json().catch(() => null));
      return res.blob();
    },
    [persist, state.user]
  );

  const authedUpload = React.useCallback<AuthContextValue["authedUpload"]>(
    async (path, form, method = "POST") => {
      const doFetch = (token: string) =>
        // NOTE: no content-type header — the browser sets the multipart boundary.
        // Uploads get a longer ceiling than JSON calls: a photo on mobile data
        // legitimately takes more than 10s, but must still never hang forever.
        fetchWithTimeout(`${BASE}/api${path}`, {
          method,
          body: form,
          headers: { authorization: `Bearer ${token}` },
        }, UPLOAD_TIMEOUT_MS);

      const tokens = tokensRef.current;
      if (!tokens) throw new Error("Not authenticated");

      let res = await doFetch(tokens.accessToken);
      if (res.status === 401) {
        try {
          const refreshed = await apiPost<{ accessToken: string; refreshToken: string }>(
            "/auth/refresh",
            { refreshToken: tokens.refreshToken }
          );
          const next = { accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken };
          persist(state.user, next);
          res = await doFetch(next.accessToken);
        } catch (err) {
          if (err instanceof ApiError && (err.kind === "timeout" || err.kind === "network")) throw err;
          persist(null, null);
          throw new Error("Session expired");
        }
      }

      const json = await res.json().catch(() => null);
      if (!res.ok) throw httpError(res.status, json, "Upload failed");
      return json as never;
    },
    [persist, state.user]
  );

  const uploadImage = React.useCallback<AuthContextValue["uploadImage"]>(
    async (path, blob, opts) => {
      const send = (token: string) =>
        new Promise<unknown>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", `${BASE}/api${path}`);
          xhr.setRequestHeader("authorization", `Bearer ${token}`);
          // Bound the upload so a stalled connection surfaces as a friendly,
          // retryable error instead of an endless progress bar.
          xhr.timeout = UPLOAD_TIMEOUT_MS;
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && opts?.onProgress) opts.onProgress(Math.round((e.loaded / e.total) * 100));
          };
          xhr.onload = () => {
            let json: { message?: string | string[] } | null = null;
            try {
              json = JSON.parse(xhr.responseText);
            } catch {
              json = null;
            }
            if (xhr.status >= 200 && xhr.status < 300) resolve(json);
            else reject({ status: xhr.status, json });
          };
          xhr.onerror = () => reject({ status: 0, json: null });
          xhr.ontimeout = () => reject({ status: 0, json: null, timeout: true });
          const fd = new FormData();
          fd.append("file", blob, opts?.filename ?? "image.webp");
          xhr.send(fd);
        });

      const tokens = tokensRef.current;
      if (!tokens) throw new Error("Not authenticated");

      try {
        return (await send(tokens.accessToken)) as never;
      } catch (err) {
        const e = err as { status?: number; json?: { message?: string | string[] }; timeout?: boolean };
        if (e.status === 401) {
          try {
            const refreshed = await apiPost<{ accessToken: string; refreshToken: string }>("/auth/refresh", {
              refreshToken: tokens.refreshToken,
            });
            const next = { accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken };
            persist(state.user, next);
            return (await send(next.accessToken)) as never;
          } catch (refreshErr) {
            if (refreshErr instanceof ApiError && (refreshErr.kind === "timeout" || refreshErr.kind === "network")) throw refreshErr;
            persist(null, null);
            throw new Error("Session expired");
          }
        }
        // status 0 = XHR timeout or network failure → friendly, retryable error.
        if (!e.status) throw new ApiError(friendly(e.timeout ? "timeout" : "network"), e.timeout ? "timeout" : "network");
        const msg = Array.isArray(e.json?.message) ? e.json?.message.join(", ") : e.json?.message;
        throw new Error(msg || `Upload failed (${e.status})`);
      }
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
      authedBlob,
      authedUpload,
      uploadImage,
    }),
    [state, login, loginWithPhone, loginWithGoogle, register, requestOtp, forgotPassword, resetPassword, logout, updateUser, authedFetch, authedBlob, authedUpload, uploadImage]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

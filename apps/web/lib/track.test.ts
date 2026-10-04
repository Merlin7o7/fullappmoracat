import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Measurement consent is real (audit 2026-10-04): nothing leaves the browser
 * — neither sink — before «موافق», and «بدون قياس» keeps it that way.
 */

function installBrowser() {
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  };
  const fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
  const win = {
    localStorage: storage,
    sessionStorage: { ...storage, getItem: () => null, setItem: () => undefined },
    location: { search: "?src=stand-004", pathname: "/" },
    dataLayer: undefined as unknown[] | undefined,
    dispatchEvent: () => true,
  };
  vi.stubGlobal("window", win);
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("sessionStorage", win.sessionStorage);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("CustomEvent", class { constructor(public type: string, public init?: unknown) {} });
  vi.stubGlobal("Event", class { constructor(public type: string) {} });
  return { win, store, fetchMock };
}

describe("track() consent gate", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://api.test");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("sends nothing before a choice", async () => {
    const { win, fetchMock } = installBrowser();
    const { track } = await import("./track");
    track("page_landed", { path: "/" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(win.dataLayer).toBeUndefined();
  });

  it("sends nothing after «بدون قياس», and forgets the anon id", async () => {
    const { win, store, fetchMock } = installBrowser();
    store.set("moraqat.anonId", "old");
    const { track, writeConsent, readConsent } = await import("./track");
    writeConsent("denied");
    track("page_landed", { path: "/" });
    expect(readConsent()).toBe("denied");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(win.dataLayer).toBeUndefined();
    expect(store.has("moraqat.anonId")).toBe(false);
  });

  it("treats the old «تمام» value as no choice", async () => {
    const { store } = installBrowser();
    store.set("moraqat.cookieConsent", "1");
    const { readConsent } = await import("./track");
    expect(readConsent()).toBeNull();
  });

  it("after «موافق», sends the held landing once", async () => {
    const { win, fetchMock } = installBrowser();
    const { trackPageLanded, writeConsent } = await import("./track");
    trackPageLanded();
    expect(fetchMock).not.toHaveBeenCalled();
    writeConsent("granted");
    expect(win.dataLayer?.length).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

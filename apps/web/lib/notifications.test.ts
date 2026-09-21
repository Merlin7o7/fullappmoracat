import { describe, expect, it } from "vitest";
import { inAppPath, notificationHref } from "./notifications";

const n = (data: unknown) => ({ title: "t", body: "b", data });

describe("inAppPath", () => {
  it("keeps a relative in-app path", () => {
    expect(inAppPath("/portal/health-access?cat=c1&org=o1&tier=T1")).toBe(
      "/portal/health-access?cat=c1&org=o1&tier=T1"
    );
  });
  it("reduces an absolute same-site URL to its path", () => {
    expect(inAppPath("https://moracat.co/portal/cats/c1/privacy")).toBe("/portal/cats/c1/privacy");
    expect(inAppPath("https://www.moracat.co/portal/lost-found")).toBe("/portal/lost-found");
  });
  it("refuses anything off-site or malformed", () => {
    expect(inAppPath("https://evil.example/portal")).toBeNull();
    expect(inAppPath("//evil.example/portal")).toBeNull();
    expect(inAppPath("javascript:alert(1)")).toBeNull();
    expect(inAppPath(42)).toBeNull();
    expect(inAppPath("")).toBeNull();
  });
});

describe("notificationHref", () => {
  it("prefers the server's own link over the generic cat fallback", () => {
    expect(notificationHref(n({ catId: "c1", link: "/portal/health-access?cat=c1" }))).toBe(
      "/portal/health-access?cat=c1"
    );
    expect(notificationHref(n({ catId: "c1", url: "https://moracat.co/portal/cats/c1/privacy" }))).toBe(
      "/portal/cats/c1/privacy"
    );
  });
  it("falls back when the link is not ours", () => {
    expect(notificationHref(n({ catId: "c1", link: "https://evil.example/x" }))).toBe("/portal/cats");
  });
  it("keeps the older fallbacks", () => {
    expect(notificationHref(n({ slug: "luna" }))).toBe("/community/luna");
    expect(notificationHref(n({ orderNumber: "M-1" }))).toBe("/portal/orders");
    expect(notificationHref(n({}))).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { jsonLdProps, serializeJsonLd } from "./json-ld";

/**
 * Regression guard for the stored-XSS hole on public cat profiles and blog
 * articles: user-controlled `name` / `bio` / excerpt reached a <script> block
 * through a bare JSON.stringify, which does not escape `<`, `>` or `/`.
 */
describe("serializeJsonLd", () => {
  const SCRIPT_BREAKOUT = '</script><img src=x onerror=alert(1)>';

  it("neutralises a script-closing payload", () => {
    const out = serializeJsonLd({ name: SCRIPT_BREAKOUT });
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).not.toContain("/");
  });

  it("preserves the value exactly — escaping must not corrupt structured data", () => {
    const data = { name: SCRIPT_BREAKOUT, bio: "Luna 🐈 — 3 سنوات", url: "https://moracat.co/community/luna" };
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });

  it("escapes U+2028 / U+2029, which are legal JSON but break JS source", () => {
    const data = { bio: `line${String.fromCharCode(0x2028)}sep${String.fromCharCode(0x2029)}para` };
    const out = serializeJsonLd(data);
    expect(out).not.toContain(String.fromCharCode(0x2028));
    expect(out).not.toContain(String.fromCharCode(0x2029));
    expect(JSON.parse(out)).toEqual(data);
  });

  it("keeps Arabic, emoji and quotes intact", () => {
    const data = { name: 'مشمش "الملك" 👑', bio: "قط لطيف" };
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });

  it("handles nested user content at any depth", () => {
    const data = { mainEntity: { author: { name: SCRIPT_BREAKOUT } } };
    const out = serializeJsonLd(data);
    expect(out).not.toContain("<");
    expect(JSON.parse(out)).toEqual(data);
  });

  it("jsonLdProps emits pre-escaped script props", () => {
    const props = jsonLdProps({ name: SCRIPT_BREAKOUT });
    expect(props.type).toBe("application/ld+json");
    expect(props.dangerouslySetInnerHTML.__html).not.toContain("<");
  });
});

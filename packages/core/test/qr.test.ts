import { describe, expect, it } from "vitest";
import { parseQrValue, qrValueFor } from "../src/qr";

const TOKEN = "7H2K94QFAB3CDEFGHJKM";

describe("qrValueFor / parseQrValue", () => {
  it("builds the public URL and reads it back", () => {
    const v = qrValueFor("https://moracat.co/", TOKEN);
    expect(v).toBe(`https://moracat.co/c/${TOKEN}`);
    expect(parseQrValue(v)).toBe(TOKEN);
  });
  it("still accepts the legacy MRCV1 form and a bare token", () => {
    expect(parseQrValue(`MRCV1:${TOKEN}`)).toBe(TOKEN);
    expect(parseQrValue(TOKEN.toLowerCase())).toBe(TOKEN);
  });
  it("rejects foreign URLs and junk", () => {
    expect(parseQrValue("https://example.com/whatever")).toBeNull();
    expect(parseQrValue("MRCV1:not-a-token")).toBeNull();
    expect(parseQrValue("")).toBeNull();
  });
});

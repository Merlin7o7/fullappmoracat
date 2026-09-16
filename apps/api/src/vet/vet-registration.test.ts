import { describe, it, expect } from "vitest";
import { StorageService } from "../storage/storage.service";
import { editableStepsFor } from "./vet-registration.service";
import { buildVetNoticeEmail } from "./vet-registration.emails";

describe("StorageService.sniffDocument — clinic paperwork", () => {
  const svc = new StorageService();

  it("accepts a real PDF, JPEG and PNG by their bytes", () => {
    expect(svc.sniffDocument(Buffer.from("%PDF-1.7\n%âãÏÓ\n1 0 obj", "latin1"))?.mime).toBe("application/pdf");
    expect(svc.sniffDocument(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))?.ext).toBe("jpg");
    expect(
      svc.sniffDocument(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))?.ext
    ).toBe("png");
  });

  it("rejects HTML, SVG and WebP pretending to be documents", () => {
    expect(svc.sniffDocument(Buffer.from("<html><script>x</script></html>"))).toBeNull();
    expect(svc.sniffDocument(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(svc.sniffDocument(Buffer.from("RIFF    WEBPVP8 ", "ascii"))).toBeNull();
  });

  it("builds private keys that can never collide with public namespaces", () => {
    const key = svc.buildPrivateKey("vet/org123", "pdf");
    expect(key).toMatch(/^private\/vet\/org123\/[0-9a-f]{64}\.pdf$/);
  });
});

describe("editableStepsFor — the registration state machine", () => {
  it("opens every step while registering", () => {
    expect(editableStepsFor("REGISTERING", [])).toEqual(["clinic", "branches", "documents", "team", "terms"]);
  });

  it("opens only the reopened steps (plus terms) after a change request", () => {
    expect(editableStepsFor("CHANGES_REQUESTED", ["documents"])).toEqual(["documents", "terms"]);
  });

  it("locks everything under review and after a decision", () => {
    for (const s of ["SUBMITTED", "IN_REVIEW", "APPROVED", "LIVE", "REJECTED"] as const) {
      expect(editableStepsFor(s, ["clinic"])).toEqual([]);
    }
  });
});

describe("buildVetNoticeEmail", () => {
  it("is bilingual, Arabic first, and escapes user-supplied text", () => {
    const mail = buildVetNoticeEmail({
      subjectAr: "مرحبا",
      subjectEn: "Hello",
      headingAr: "عنوان",
      headingEn: "Heading",
      bodyAr: ["نص"],
      bodyEn: ["Body"],
      quote: '<img src=x onerror="alert(1)">',
      cta: { labelAr: "افتح", labelEn: "Open", url: "https://www.moracat.co/vet/register?token=a&b" },
    });
    expect(mail.subject).toBe("مرحبا · Hello");
    expect(mail.html.indexOf("عنوان")).toBeLessThan(mail.html.indexOf("Heading"));
    expect(mail.html).not.toContain("<img src=x");
    expect(mail.html).toContain("&lt;img src=x");
    expect(mail.html).toContain("token=a&amp;b");
    expect(mail.text).toContain("Open: https://www.moracat.co/vet/register?token=a&b");
  });
});

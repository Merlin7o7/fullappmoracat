import { describe, expect, it } from "vitest";
import { breadcrumbJsonLd, type Crumb } from "./breadcrumbs";
import { serializeJsonLd } from "./json-ld";

const SITE = "https://moracat.co";

describe("breadcrumbJsonLd", () => {
  const trail: Crumb[] = [
    { href: "/", label: "Home" },
    { href: "/blog", label: "Journal" },
    { label: "Why cats knead" },
  ];

  it("numbers positions from 1 in trail order", () => {
    const ld = breadcrumbJsonLd(trail, SITE);
    expect(ld["@type"]).toBe("BreadcrumbList");
    expect(ld.itemListElement.map((e) => e.position)).toEqual([1, 2, 3]);
  });

  it("builds absolute item URLs and omits item on the current page", () => {
    const ld = breadcrumbJsonLd(trail, SITE);
    expect(ld.itemListElement[0]).toMatchObject({ item: "https://moracat.co/" });
    expect(ld.itemListElement[1]).toMatchObject({ item: "https://moracat.co/blog" });
    expect(ld.itemListElement[2]).not.toHaveProperty("item");
    expect(ld.itemListElement[2]?.name).toBe("Why cats knead");
  });

  it("keeps Arabic labels intact through the safe serializer", () => {
    const ld = breadcrumbJsonLd([{ href: "/", label: "الرئيسية" }, { label: "دليل العيادات" }], SITE);
    expect(JSON.parse(serializeJsonLd(ld))).toEqual(ld);
  });

  it("neutralises hostile labels when serialized (user-titled posts/cats)", () => {
    const hostile = '</script><img src=x onerror=alert(1)>';
    const out = serializeJsonLd(breadcrumbJsonLd([{ href: "/", label: "Home" }, { label: hostile }], SITE));
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
  });
});

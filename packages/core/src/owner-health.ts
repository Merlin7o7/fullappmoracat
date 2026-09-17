/**
 * The owner's view of a clinic-written record (MRC-PROD-001 T3, decision D5).
 *
 * Vets write for vets: free-text notes, assessments and plans are clinical
 * shorthand and stay inside the clinic portal. Owners get the *facts* — which
 * vaccine, what weight, which medication, when — in both languages. This
 * module is the only place that decides which payload keys an owner may see,
 * so the API and any future export agree. Clinical values (a drug name, a
 * vaccine brand) are never machine-translated; only the framing words change.
 */

export interface Bilingual {
  ar: string;
  en: string;
}

export interface OwnerEntryView {
  title: Bilingual;
  /** One short line of facts, or null when the entry is only its title. */
  summary: Bilingual | null;
}

export const OWNER_ENTRY_KIND_LABELS: Record<string, Bilingual> = {
  EXAM: { ar: "فحص", en: "Check-up" },
  DIAGNOSIS: { ar: "تشخيص", en: "Diagnosis" },
  VACCINATION: { ar: "تطعيم", en: "Vaccination" },
  TREATMENT: { ar: "علاج", en: "Treatment" },
  PRESCRIPTION: { ar: "وصفة", en: "Prescription" },
  LAB: { ar: "تحليل مخبري", en: "Lab test" },
  IMAGING: { ar: "أشعة", en: "Imaging" },
  SURGERY: { ar: "عملية جراحية", en: "Surgery" },
  DENTAL: { ar: "أسنان", en: "Dental" },
  HOSPITALIZATION: { ar: "تنويم", en: "Hospital stay" },
  WEIGHT: { ar: "وزن", en: "Weight" },
  NUTRITION: { ar: "تغذية", en: "Nutrition" },
  SUPPLEMENT: { ar: "مكمّل غذائي", en: "Supplement" },
};

/** Entry kinds an owner never sees as a timeline item. */
export const OWNER_HIDDEN_ENTRY_TYPES = ["NOTE"] as const;

export const ACQUISITION_SOURCE_LABELS: Record<string, Bilingual> = {
  ADOPTED: { ar: "تبنّي", en: "Adopted" },
  PURCHASED_BREEDER: { ar: "من مربّي", en: "From a breeder" },
  PURCHASED_SHOP: { ar: "من متجر", en: "From a shop" },
  RESCUED_STRAY: { ar: "إنقاذ من الشارع", en: "Rescued" },
  GIFT: { ar: "هدية", en: "A gift" },
  BORN_AT_HOME: { ar: "وُلد في البيت", en: "Born at home" },
  OTHER: { ar: "أخرى", en: "Other" },
};

function str(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim().slice(0, 160);
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function join(parts: Array<string | null>, sep = " · "): string | null {
  const kept = parts.filter((p): p is string => !!p);
  return kept.length ? kept.join(sep) : null;
}

function both(ar: string | null, en: string | null): Bilingual | null {
  return ar || en ? { ar: ar ?? en ?? "", en: en ?? ar ?? "" } : null;
}

/**
 * Describe one clinical entry for its owner, or return null when the kind is
 * not shown to owners at all. `payload` is the raw clinical JSON; only the
 * keys named here are ever read from it.
 */
export function describeEntryForOwner(type: string, payload: unknown): OwnerEntryView | null {
  if ((OWNER_HIDDEN_ENTRY_TYPES as readonly string[]).includes(type)) return null;
  const kind = OWNER_ENTRY_KIND_LABELS[type] ?? { ar: type, en: type };
  const p = (payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {}) as Record<string, unknown>;
  const titled = (name: string | null): Bilingual => (name ? { ar: name, en: name } : kind);

  switch (type) {
    case "VACCINATION": {
      const vaccine = str(p.vaccine);
      const due = str(p.dueAt);
      return {
        title: titled(vaccine),
        summary: both(due ? `الجرعة التالية ${due.slice(0, 10)}` : null, due ? `Next dose ${due.slice(0, 10)}` : null),
      };
    }
    case "WEIGHT": {
      const kg = str(p.weightKg);
      const bcs = str(p.bcs);
      return {
        title: kg ? { ar: `${kg} كجم`, en: `${kg} kg` } : kind,
        summary: both(bcs ? `مؤشر الجسم ${bcs}/9` : null, bcs ? `Body condition ${bcs}/9` : null),
      };
    }
    case "PRESCRIPTION": {
      const med = str(p.medication);
      const line = join([str(p.dosage), str(p.frequency)]);
      return { title: titled(med), summary: both(line, line) };
    }
    case "DIAGNOSIS": {
      const condition = str(p.condition);
      const status = str(p.status);
      return { title: titled(condition), summary: both(status, status) };
    }
    case "EXAM": {
      const vitals = join([
        str(p.temperatureC) ? `${str(p.temperatureC)}°C` : null,
        str(p.heartRate) ? `HR ${str(p.heartRate)}` : null,
        str(p.respRate) ? `RR ${str(p.respRate)}` : null,
      ]);
      return { title: kind, summary: both(vitals, vitals) };
    }
    case "LAB": {
      const panel = str(p.panel);
      const results = Array.isArray(p.results) ? (p.results as Array<Record<string, unknown>>) : [];
      const flagged = results.filter((r) => {
        const f = String(r.flag ?? "").toLowerCase();
        return f && f !== "normal";
      }).length;
      return {
        title: titled(panel),
        summary: both(
          results.length ? (flagged ? `${flagged} نتيجة خارج المدى — اسأل طبيبك` : "النتائج ضمن المدى") : "النتائج محفوظة لدى العيادة",
          results.length ? (flagged ? `${flagged} out of range — ask your vet` : "All within range") : "Results on file at the clinic"
        ),
      };
    }
    case "IMAGING":
    case "SURGERY":
    case "DENTAL":
    case "HOSPITALIZATION":
    case "TREATMENT":
    case "NUTRITION":
    case "SUPPLEMENT": {
      const name = str(p.procedure) ?? str(p.name) ?? str(p.product) ?? str(p.title);
      return { title: kind, summary: both(name, name) };
    }
    default:
      return { title: kind, summary: null };
  }
}

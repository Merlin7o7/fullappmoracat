export * from "./feeding/types";
export * from "./feeding/constants";
export { calculateFeeding, DEFAULT_COSTS } from "./feeding/engine";
// Veterinary platform — the clinic-side capability matrix, shared verbatim by
// the API guard and the portal UI so authorisation can never drift from what
// the interface offers.
export * from "./vet-permissions";
// Box economics — the authoritative model for what a box costs, what it is
// worth to a member versus buying à-la-carte, and whether it may be sold at
// all. Shared so the seed guardrail, the API and any pricing tool agree.
export * from "./pricing/box-economics";
// The veterinary API contract — enums and envelope shapes shared verbatim by the
// NestJS services and the clinic portal, so the two cannot drift apart again.
export * from "./vet-contract";
// Vaccination standing, derived from the records rather than stored as a claim.
export * from "./vaccination-status";
// The Census (Phase 0) — founding status derived from the sequential Cat ID
// number, so the badge cannot be set, only earned.
export * from "./census";
// Where a cat lives, for the census — deliberately independent of the delivery
// City table, which only knows the cities we can actually ship to.
export * from "./saudi-cities";
// Clinic registration (MRC-VET-002) — steps, Saudi field rules, the one
// completeness check, the go-live checklist and the versioned terms text.
export * from "./vet-registration";
// Product events + the operating metrics (MRC-PROD-001 T2) — one vocabulary
// for the API, the web app and the nightly roll-up.
export * from "./events";
export * from "./metrics";
// The owner's view of clinic-written records — the only place that decides
// which clinical facts leave the clinic portal (MRC-PROD-001 T3).
export * from "./owner-health";
// Clinic-created patients + the claim link (MRC-PROD-001 T4).
export * from "./claim";
// The Cat ID QR: public URL out, every older form still accepted in (T6).
export * from "./qr";

// T7/T8 — renewal dunning ladder and honest cancel reasons.
export * from "./dunning";
export * from "./cancel-reasons";

// The member-facing API contract — the read models and bilingual state labels
// shared verbatim by the API, the web portal and the iOS app. Second client,
// same lesson as vet-contract.ts: one declaration, or the copies drift and a
// screen renders blank in someone's hand.
export * from "./member-contract";

// Prayer-aware notification timing (R107) — computed times plus the product
// rule about which notifications may be held and which never are.
export * from "./prayer-times";

// Any-script digits → Latin: Arabic keyboards type ٠–٩ and no field may drop them.
export * from "./digits";

// The membership price list + term/household maths — one declaration shared by
// the catalog seed, the API and the web (R021).
export * from "./plans";

// What happens at the end of a paid term — one wording for every surface (R021/R025).
export * from "./renewal-policy";

// One formatter for numbers, money, dates, ages and weights — Western digits,
// Gregorian by default, real Arabic plural grammar (R110).
export * from "./format";

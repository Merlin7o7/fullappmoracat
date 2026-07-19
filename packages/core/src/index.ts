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

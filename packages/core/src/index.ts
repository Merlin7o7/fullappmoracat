export * from "./feeding/types";
export * from "./feeding/constants";
export { calculateFeeding, DEFAULT_COSTS } from "./feeding/engine";
// Veterinary platform — the clinic-side capability matrix, shared verbatim by
// the API guard and the portal UI so authorisation can never drift from what
// the interface offers.
export * from "./vet-permissions";

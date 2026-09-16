import type { RegistrationStep } from "@moraqat/core";
import type { RegistrationApi, RegistrationState } from "@/lib/vet-registration";

/** Steps the wizard walks after the owner account exists. */
export type WizardStep = Exclude<RegistrationStep, "account">;

export const WIZARD_STEPS: WizardStep[] = ["clinic", "branches", "documents", "team", "terms"];

export interface StepProps {
  orgId: string;
  state: RegistrationState;
  api: RegistrationApi;
  isAr: boolean;
  /** Every mutating call returns the full state — replace local state with it. */
  onState: (next: RegistrationState) => void;
  /** Move to the next step after a successful save. */
  onNext: () => void;
  /** Previous step, when there is one. */
  onBack?: () => void;
  /** Jump to a specific step (review links, gap links). */
  goTo: (step: WizardStep) => void;
}

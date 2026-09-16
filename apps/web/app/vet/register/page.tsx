"use client";

/**
 * Clinic registration wizard — MRC-VET-002 phase 2.
 *
 * The page stays a thin door (page files may only export the default
 * component); the flow lives in components/vet/registration/.
 */

import { RegistrationEntry } from "@/components/vet/registration/registration-entry";

export default function VetRegisterPage() {
  return <RegistrationEntry />;
}

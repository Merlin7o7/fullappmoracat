/**
 * Clinical-entry DTOs — MRC-VET-001 §10.
 *
 * `ClinicalEntry.payload` is Json in the database so the timeline stays one
 * queryable stream, but it is NEVER free-form at the API boundary: each
 * `ClinicalEntryType` has a typed payload class here, and the service validates
 * the body against exactly one of them (`validateEntryPayload`). Structured
 * fields are what let a vaccination become an owner reminder and a weight become
 * a chart — an untyped blob would make the whole platform thesis unbuildable.
 *
 * Every payload class is `whitelist + forbidNonWhitelisted` validated, so an
 * unknown key is a 400, not a silently persisted mystery field in a medical
 * record.
 */
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type, plainToInstance } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmptyObject,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  validateSync,
} from "class-validator";

export const CLINICAL_ENTRY_TYPES = [
  "EXAM",
  "DIAGNOSIS",
  "VACCINATION",
  "TREATMENT",
  "PRESCRIPTION",
  "LAB",
  "IMAGING",
  "SURGERY",
  "DENTAL",
  "HOSPITALIZATION",
  "WEIGHT",
  "NUTRITION",
  "SUPPLEMENT",
  "NOTE",
] as const;
export type ClinicalEntryTypeName = (typeof CLINICAL_ENTRY_TYPES)[number];

// ── Per-type payloads ─────────────────────────────────────────────────────

/** SOAP-lite. Every field optional (§09): a vet must never be blocked by a form. */
export class ExamPayloadDto {
  @ApiPropertyOptional({ description: "S — what the owner reports" })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  subjective?: string;

  @ApiPropertyOptional({ description: "O — measured findings" })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  objective?: string;

  @ApiPropertyOptional({ description: "A — assessment" })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  assessment?: string;

  @ApiPropertyOptional({ description: "P — plan" })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  plan?: string;

  @ApiPropertyOptional({ example: 38.6, description: "Temperature in °C" })
  @IsOptional()
  @IsNumber()
  @Min(20)
  @Max(45)
  temperatureC?: number;

  @ApiPropertyOptional({ example: 180, description: "Heart rate, bpm" })
  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(400)
  heartRate?: number;

  @ApiPropertyOptional({ example: 28, description: "Respiratory rate, breaths/min" })
  @IsOptional()
  @IsInt()
  @Min(4)
  @Max(200)
  respiratoryRate?: number;
}

export const DIAGNOSIS_SEVERITIES = ["MILD", "MODERATE", "SEVERE", "CRITICAL"] as const;
export const DIAGNOSIS_STATUSES = ["SUSPECTED", "CONFIRMED", "RESOLVED", "CHRONIC", "RULED_OUT"] as const;

export class DiagnosisPayloadDto {
  @ApiProperty({ example: "Feline lower urinary tract disease" })
  @IsString()
  @MaxLength(200)
  condition!: string;

  @ApiPropertyOptional({ enum: DIAGNOSIS_SEVERITIES })
  @IsOptional()
  @IsIn(DIAGNOSIS_SEVERITIES)
  severity?: (typeof DIAGNOSIS_SEVERITIES)[number];

  @ApiPropertyOptional({ enum: DIAGNOSIS_STATUSES, default: "CONFIRMED" })
  @IsOptional()
  @IsIn(DIAGNOSIS_STATUSES)
  status?: (typeof DIAGNOSIS_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export const VACCINATION_ROUTES = ["SC", "IM", "IN", "ORAL", "OTHER"] as const;

export class VaccinationPayloadDto {
  @ApiProperty({ example: "Tricat Trio (FVRCP)" })
  @IsString()
  @MaxLength(120)
  vaccine!: string;

  @ApiPropertyOptional({ example: "B-4471X" })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  batchNo?: string;

  @ApiPropertyOptional({ example: "Left shoulder", description: "Injection site" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  site?: string;

  @ApiPropertyOptional({ enum: VACCINATION_ROUTES })
  @IsOptional()
  @IsIn(VACCINATION_ROUTES)
  route?: (typeof VACCINATION_ROUTES)[number];

  @ApiPropertyOptional({ example: "Zoetis" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  manufacturer?: string;

  @ApiPropertyOptional({
    example: "2027-08-03",
    description: "Next dose due — this is the date that becomes the owner's reminder.",
  })
  @IsOptional()
  @IsDateString()
  dueAt?: string;
}

export class TreatmentPayloadDto {
  @ApiPropertyOptional({ example: "Otitis externa" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  diagnosis?: string;

  @ApiProperty({ example: "Ear flush + topical antibiotic" })
  @IsString()
  @MaxLength(400)
  treatment!: string;

  @ApiPropertyOptional({ example: "Otomax" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  medication?: string;

  @ApiPropertyOptional({ example: "3 drops" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  dosage?: string;

  @ApiPropertyOptional({ example: "Twice daily" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  frequency?: string;

  @ApiPropertyOptional({ example: 7 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  durationDays?: number;

  @ApiPropertyOptional({ example: "Resolved at recheck" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  outcome?: string;

  @ApiPropertyOptional({ example: "2026-08-01" })
  @IsOptional()
  @IsDateString()
  followUpAt?: string;
}

export const PRESCRIPTION_FORMS = ["tablet", "capsule", "suspension", "injection", "topical", "drops", "other"] as const;

export class PrescriptionPayloadDto {
  @ApiProperty({ example: "Amoxicillin/clavulanate" })
  @IsString()
  @MaxLength(160)
  medication!: string;

  @ApiPropertyOptional({ example: "50 mg" })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  strength?: string;

  @ApiPropertyOptional({ enum: PRESCRIPTION_FORMS })
  @IsOptional()
  @IsIn(PRESCRIPTION_FORMS)
  form?: (typeof PRESCRIPTION_FORMS)[number];

  @ApiProperty({ example: "1 tablet" })
  @IsString()
  @MaxLength(120)
  dosage!: string;

  @ApiProperty({ example: "Every 12 hours" })
  @IsString()
  @MaxLength(120)
  frequency!: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  durationDays?: number;

  @ApiPropertyOptional({ example: "20 tablets" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  quantity?: string;

  @ApiPropertyOptional({ example: "Give with food." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(12)
  refillsAllowed?: number;

  @ApiPropertyOptional({ example: "2026-09-01" })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class LabResultDto {
  @ApiProperty({ example: "Creatinine" })
  @IsString()
  @MaxLength(120)
  analyte!: string;

  @ApiProperty({ example: "1.4" })
  @IsString()
  @MaxLength(60)
  value!: string;

  @ApiPropertyOptional({ example: "mg/dL" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string;

  @ApiPropertyOptional({ example: "0.8–2.4" })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  referenceRange?: string;

  @ApiPropertyOptional({ enum: ["LOW", "NORMAL", "HIGH", "ABNORMAL"] })
  @IsOptional()
  @IsIn(["LOW", "NORMAL", "HIGH", "ABNORMAL"])
  flag?: "LOW" | "NORMAL" | "HIGH" | "ABNORMAL";
}

export class LabPayloadDto {
  @ApiProperty({ example: "Renal panel" })
  @IsString()
  @MaxLength(160)
  panel!: string;

  @ApiPropertyOptional({ example: "IDEXX Riyadh" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  laboratory?: string;

  @ApiPropertyOptional({ example: "2026-07-18" })
  @IsOptional()
  @IsDateString()
  sampledAt?: string;

  @ApiPropertyOptional({ type: () => [LabResultDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => LabResultDto)
  results?: LabResultDto[];

  @ApiPropertyOptional({ description: "The clinician's reading of the numbers." })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  interpretation?: string;
}

export const IMAGING_MODALITIES = ["XRAY", "ULTRASOUND", "CT", "MRI", "ENDOSCOPY", "OTHER"] as const;

export class ImagingPayloadDto {
  @ApiProperty({ enum: IMAGING_MODALITIES })
  @IsIn(IMAGING_MODALITIES)
  modality!: (typeof IMAGING_MODALITIES)[number];

  @ApiProperty({ example: "Right lateral abdomen" })
  @IsString()
  @MaxLength(200)
  region!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  findings?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  interpretation?: string;
}

export class SurgeryPayloadDto {
  @ApiProperty({ example: "Ovariohysterectomy" })
  @IsString()
  @MaxLength(200)
  procedure!: string;

  @ApiPropertyOptional({ example: "Isoflurane, 42 min" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  anaesthesia?: string;

  @ApiPropertyOptional({ example: "None" })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  complications?: string;

  @ApiPropertyOptional({ description: "Goes home with the owner — plain language." })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  dischargeInstructions?: string;

  @ApiPropertyOptional({ example: "2026-08-01" })
  @IsOptional()
  @IsDateString()
  followUpAt?: string;
}

export class DentalPayloadDto {
  @ApiProperty({ example: "Scale and polish" })
  @IsString()
  @MaxLength(200)
  procedure!: string;

  @ApiPropertyOptional({ example: 2, description: "Dental grade 0–4" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(4)
  grade?: number;

  @ApiPropertyOptional({ type: () => [String], example: ["307", "407"] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  extractions?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  findings?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  homeCare?: string;
}

export class HospitalizationPayloadDto {
  @ApiProperty({ example: "2026-07-18T09:00:00.000Z" })
  @IsDateString()
  admittedAt!: string;

  @ApiPropertyOptional({ example: "2026-07-20T11:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  dischargedAt?: string;

  @ApiProperty({ example: "Blocked bladder — stabilisation" })
  @IsString()
  @MaxLength(400)
  reason!: string;

  @ApiPropertyOptional({ example: "Ward B, kennel 4" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  ward?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  monitoring?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  dischargeInstructions?: string;
}

export class WeightPayloadDto {
  @ApiProperty({ example: 4.2, description: "Weight in kilograms." })
  @IsNumber()
  @Min(0.05)
  @Max(40)
  weightKg!: number;

  @ApiPropertyOptional({ example: 5, description: "Body condition score, 1–9 (WSAVA)." })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9)
  bcs?: number;

  @ApiPropertyOptional({ example: 22, description: "Muscle condition / other operator note." })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  method?: string;
}

export const DIET_TYPES = ["DRY", "WET", "MIXED", "RAW", "PRESCRIPTION", "HOME_COOKED", "OTHER"] as const;

export class NutritionPayloadDto {
  @ApiProperty({ enum: DIET_TYPES })
  @IsIn(DIET_TYPES)
  dietType!: (typeof DIET_TYPES)[number];

  @ApiPropertyOptional({ example: "Royal Canin" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;

  @ApiPropertyOptional({ example: "Urinary S/O" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  product?: string;

  @ApiPropertyOptional({ example: 240 })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(2000)
  caloriesPerDay?: number;

  @ApiPropertyOptional({ example: "180 ml/day" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  waterIntake?: string;

  @ApiPropertyOptional({ example: "2 meals — 07:00 and 19:00" })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  schedule?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export const COMPLIANCE_LEVELS = ["GOOD", "PARTIAL", "POOR", "UNKNOWN"] as const;

export class SupplementPayloadDto {
  @ApiProperty({ example: "Omega-3" })
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ example: "Nutramax" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;

  @ApiPropertyOptional({ example: "Coat and joint support" })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  reason?: string;

  @ApiPropertyOptional({ example: "1 pump" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  dosage?: string;

  @ApiPropertyOptional({ example: "Daily" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  frequency?: string;

  @ApiPropertyOptional({ enum: COMPLIANCE_LEVELS })
  @IsOptional()
  @IsIn(COMPLIANCE_LEVELS)
  compliance?: (typeof COMPLIANCE_LEVELS)[number];
}

export const NOTE_SUBTYPES = ["GENERAL", "HANDLING", "BEHAVIOUR", "OWNER_COMMUNICATION", "REFERRAL"] as const;

export class NotePayloadDto {
  @ApiProperty({ example: "Hates carriers — wrap in a towel and she settles." })
  @IsString()
  @MaxLength(4000)
  text!: string;

  @ApiPropertyOptional({
    enum: NOTE_SUBTYPES,
    description: "HANDLING/BEHAVIOUR notes surface in the tier-0 handling band.",
  })
  @IsOptional()
  @IsIn(NOTE_SUBTYPES)
  subtype?: (typeof NOTE_SUBTYPES)[number];
}

/** The registry the service validates against. One entry per ClinicalEntryType. */
export const ENTRY_PAYLOAD_CLASSES = {
  EXAM: ExamPayloadDto,
  DIAGNOSIS: DiagnosisPayloadDto,
  VACCINATION: VaccinationPayloadDto,
  TREATMENT: TreatmentPayloadDto,
  PRESCRIPTION: PrescriptionPayloadDto,
  LAB: LabPayloadDto,
  IMAGING: ImagingPayloadDto,
  SURGERY: SurgeryPayloadDto,
  DENTAL: DentalPayloadDto,
  HOSPITALIZATION: HospitalizationPayloadDto,
  WEIGHT: WeightPayloadDto,
  NUTRITION: NutritionPayloadDto,
  SUPPLEMENT: SupplementPayloadDto,
  NOTE: NotePayloadDto,
} as const satisfies Record<ClinicalEntryTypeName, unknown>;

export interface PayloadFieldError {
  field: string;
  problems: string[];
}

/**
 * Validate a raw payload against the class registered for `type`.
 * Returns the sanitised object (unknown keys are an error, not a silent drop —
 * a medical record must contain exactly what was reviewed) or the field errors.
 */
export function validateEntryPayload(
  type: ClinicalEntryTypeName,
  raw: unknown
): { ok: true; value: Record<string, unknown> } | { ok: false; errors: PayloadFieldError[] } {
  const cls = ENTRY_PAYLOAD_CLASSES[type] as new () => object;
  const instance = plainToInstance(cls, raw ?? {}, { enableImplicitConversion: true });
  const failures = validateSync(instance as object, {
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
  });
  if (failures.length) {
    const flatten = (prefix: string, list: typeof failures): PayloadFieldError[] =>
      list.flatMap((f) => {
        const field = prefix ? `${prefix}.${f.property}` : f.property;
        const own = f.constraints
          ? [{ field, problems: Object.values(f.constraints) }]
          : [];
        const kids = f.children?.length ? flatten(field, f.children) : [];
        return [...own, ...kids];
      });
    return { ok: false, errors: flatten("", failures) };
  }
  return { ok: true, value: JSON.parse(JSON.stringify(instance)) as Record<string, unknown> };
}

// ── Request bodies ────────────────────────────────────────────────────────

export class CreateClinicalEntryDto {
  @ApiProperty({ description: "The cat this record belongs to." })
  @IsString()
  @MaxLength(40)
  catId!: string;

  @ApiPropertyOptional({
    description:
      "The visit this entry belongs to. Omit for a standalone record; if given it must be an " +
      "OPEN visit for this cat at this org.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  visitId?: string;

  @ApiProperty({ enum: CLINICAL_ENTRY_TYPES })
  @IsIn(CLINICAL_ENTRY_TYPES)
  type!: ClinicalEntryTypeName;

  @ApiProperty({
    type: "object",
    additionalProperties: true,
    description: "Type-specific body. Validated against the payload class for `type`.",
  })
  @IsObject()
  @IsNotEmptyObject()
  payload!: Record<string, unknown>;

  @ApiPropertyOptional({ description: "Free-text clinician note, kept searchable outside the payload." })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string;

  @ApiPropertyOptional({
    description: "When care actually happened. Defaults to now; may not be in the future.",
  })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}

export class ReviseClinicalEntryDto {
  @ApiProperty({
    type: "object",
    additionalProperties: true,
    description: "The corrected payload, in full. The original stays readable, marked AMENDED.",
  })
  @IsObject()
  @IsNotEmptyObject()
  payload!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string;

  @ApiPropertyOptional({ description: "Why the correction was needed — kept on the new revision." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}

export class RetractClinicalEntryDto {
  @ApiProperty({
    example: "Recorded on the wrong cat — re-entered under MRC-D7Y9-X5CW.",
    description: "Required. A retraction without a reason is not an audit trail.",
  })
  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class CoSignClinicalEntryDto {
  @ApiPropertyOptional({
    description: "Optional note from the co-signing clinician, appended to the entry's note.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export const ATTACHMENT_KINDS = ["xray", "ultrasound", "photo", "pdf", "lab", "other"] as const;

export class CreateAttachmentDto {
  @ApiProperty({
    description:
      "Object URL returned by POST /api/uploads/image, or another already-stored object. " +
      "Must be an http(s) URL on a storage host — never a data: or file: URI.",
    example: "https://media.moracat.sa/users/abc/uploads/9f2.jpg",
  })
  @IsString()
  @MaxLength(2000)
  fileUrl!: string;

  @ApiPropertyOptional({ example: "thorax-lateral.jpg" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fileName?: string;

  @ApiPropertyOptional({ example: "image/jpeg" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  mime?: string;

  @ApiPropertyOptional({ example: 482_113, description: "Size in bytes. 25 MB per file maximum." })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(25 * 1024 * 1024)
  bytes?: number;

  @ApiPropertyOptional({ enum: ATTACHMENT_KINDS })
  @IsOptional()
  @IsIn(ATTACHMENT_KINDS)
  kind?: (typeof ATTACHMENT_KINDS)[number];
}

export const PRESCRIPTION_ACTIONS = ["dispense", "refill", "complete", "cancel"] as const;
export type PrescriptionAction = (typeof PRESCRIPTION_ACTIONS)[number];

export class UpdatePrescriptionStatusDto {
  @ApiProperty({
    enum: PRESCRIPTION_ACTIONS,
    description:
      "dispense → COLLECTED · refill → REFILLED (consumes one allowed refill) · " +
      "complete → COMPLETED · cancel → CANCELLED.",
  })
  @IsIn(PRESCRIPTION_ACTIONS)
  action!: PrescriptionAction;

  @ApiPropertyOptional({ description: "Required for `cancel` — the owner deserves a reason." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ description: "Tell the owner their medication is ready / done." })
  @IsOptional()
  @IsBoolean()
  notifyOwner?: boolean;
}

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import type { VetRole } from "@moraqat/core";
import { PIN_RE } from "./vet-auth.dto";

/** Every clinic role. Which of these a caller may actually assign is decided by
 *  `assignableRoles()` from @moraqat/core, never by this list. */
export const VET_ROLES = [
  "OWNER",
  "MANAGER",
  "VET_SENIOR",
  "VET",
  "VET_TECH",
  "RECEPTION",
  "FINANCE",
  "INTERN",
] as const;

export const VET_STAFF_STATUSES = ["INVITED", "ACTIVE", "SUSPENDED", "OFFBOARDED"] as const;

export class StaffListQueryDto {
  @ApiPropertyOptional({ enum: VET_STAFF_STATUSES })
  @IsOptional()
  @IsIn(VET_STAFF_STATUSES)
  status?: (typeof VET_STAFF_STATUSES)[number];

  @ApiPropertyOptional({ enum: VET_ROLES })
  @IsOptional()
  @IsIn(VET_ROLES)
  role?: VetRole;

  @ApiPropertyOptional({ description: "Match on name or email." })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 25, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class InviteStaffDto {
  @ApiProperty({ example: "sami@olayavet.sa" })
  @IsEmail({}, { message: "Enter a valid email address" })
  @MaxLength(160)
  email!: string;

  @ApiProperty({ enum: VET_ROLES })
  @IsIn(VET_ROLES, { message: "Unknown clinic role" })
  role!: VetRole;

  @ApiPropertyOptional({
    type: [String],
    description: "Branch scope. Omit or send an empty array for org-wide access.",
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  @MaxLength(40, { each: true })
  branchIds?: string[];

  @ApiPropertyOptional({ example: "Dr.", description: "Title shown on records they author." })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;
}

export class ChangeStaffRoleDto {
  @ApiProperty({ enum: VET_ROLES })
  @IsIn(VET_ROLES, { message: "Unknown clinic role" })
  role!: VetRole;

  @ApiPropertyOptional({ type: [String], description: "Replaces the branch scope when provided." })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  @MaxLength(40, { each: true })
  branchIds?: string[];

  @ApiPropertyOptional({ example: "Dr." })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @ApiPropertyOptional({ example: "VET-77120", description: "Practitioner licence number." })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  licenceNo?: string;
}

export class StaffReasonDto {
  @ApiPropertyOptional({ description: "Recorded in the audit trail." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class SetOwnPinDto {
  @ApiProperty({ example: "4821", description: "New 4–6 digit counter PIN." })
  @IsString()
  @Matches(PIN_RE, { message: "PIN must be 4 to 6 digits" })
  pin!: string;

  @ApiPropertyOptional({ description: "Current PIN — required when replacing an existing one." })
  @IsOptional()
  @IsString()
  @Matches(PIN_RE, { message: "PIN must be 4 to 6 digits" })
  currentPin?: string;
}

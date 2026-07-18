import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  MaxLength,
} from "class-validator";

export const GENDERS = ["MALE", "FEMALE", "UNSPECIFIED"] as const;
export type Gender = (typeof GENDERS)[number];
export const OTP_PURPOSES = ["REGISTER", "LOGIN", "VERIFY_PHONE"] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

// E.164-ish: optional +, 8–15 digits. Dial code is captured separately so the
// UI can default to Saudi Arabia (+966) with the fewest possible steps.
const PHONE_RE = /^\+?[0-9]{8,15}$/;

export class RegisterDto {
  @ApiProperty({ example: "sara@example.com" })
  @IsEmail()
  email!: string;

  // Password is optional at the API layer because Google sign-ups have none;
  // the phone-first flow still requires it via the register form. When present
  // it must be strong.
  @ApiPropertyOptional({ example: "S3cure!pass", minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  @MaxLength(72)
  @Matches(/[A-Za-z]/, { message: "Password must contain a letter" })
  @Matches(/\d/, { message: "Password must contain a number" })
  password?: string;

  /** Full name — split into first/last server-side to keep the form to one field. */
  @ApiPropertyOptional({ example: "Sara Al-Otaibi" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional({ example: "Sara" })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  firstName?: string;

  @ApiPropertyOptional({ example: "Al-Otaibi" })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  lastName?: string;

  @ApiPropertyOptional({ example: "+966500000000", description: "Mobile number (optional)" })
  @IsOptional()
  @Matches(PHONE_RE, { message: "Invalid phone number" })
  phone?: string;

  @ApiPropertyOptional({ example: "+966", default: "+966" })
  @IsOptional()
  @IsString()
  @Matches(/^\+[0-9]{1,4}$/, { message: "Invalid country code" })
  dialCode?: string;

  @ApiPropertyOptional({ enum: GENDERS })
  @IsOptional()
  @IsIn(GENDERS)
  gender?: Gender;

  @ApiProperty({ example: true, description: "Terms & Privacy acceptance (required)" })
  @IsBoolean()
  acceptTerms!: boolean;

  /** When present, verifies the phone during registration via SMS OTP. */
  @ApiPropertyOptional({ example: "123456" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4,6}$/, { message: "OTP must be 4–6 digits" })
  otp?: string;

  /** Referral code from ?ref= — attributes the signup to the inviting member. */
  @ApiPropertyOptional({ example: "7QK4M2P" })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  ref?: string;
}

export class LoginDto {
  @ApiProperty({ example: "sara@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "S3cure!pass" })
  @IsString()
  password!: string;

  @ApiPropertyOptional({ description: "6-digit TOTP code when 2FA is enabled" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: "2FA code must be 6 digits" })
  totp?: string;

  @ApiPropertyOptional({ description: "Keep me signed in (longer session)" })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

export class RequestOtpDto {
  @ApiProperty({ example: "+966500000000" })
  @Matches(PHONE_RE, { message: "Invalid phone number" })
  phone!: string;

  @ApiPropertyOptional({ enum: OTP_PURPOSES, default: "LOGIN" })
  @IsOptional()
  @IsIn(OTP_PURPOSES)
  purpose?: OtpPurpose;
}

export class PhoneLoginDto {
  @ApiProperty({ example: "+966500000000" })
  @Matches(PHONE_RE, { message: "Invalid phone number" })
  phone!: string;

  @ApiProperty({ example: "123456" })
  @IsString()
  @Matches(/^\d{4,6}$/, { message: "OTP must be 4–6 digits" })
  otp!: string;

  @ApiPropertyOptional({ description: "Keep me signed in (longer session)" })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

export class GoogleAuthDto {
  @ApiProperty({ description: "Google ID token (credential) from Google Identity Services" })
  @IsString()
  idToken!: string;

  @ApiPropertyOptional({ description: "Keep me signed in (longer session)" })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: "sara@example.com" })
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: "The reset token from the email link" })
  @IsString()
  token!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/[A-Za-z]/, { message: "Password must contain a letter" })
  @Matches(/\d/, { message: "Password must contain a number" })
  newPassword!: string;
}

export class RefreshDto {
  @ApiProperty({ description: "The refresh token issued at login" })
  @IsString()
  refreshToken!: string;
}

export class Verify2faDto {
  @ApiProperty({ example: "123456" })
  @IsString()
  @Matches(/^\d{6}$/, { message: "Code must be 6 digits" })
  code!: string;
}

export class Disable2faDto {
  @ApiPropertyOptional({ description: "Account password (required unless password-less)" })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ example: "123456", description: "Current 2FA code (used when no password is set)" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: "Code must be 6 digits" })
  code?: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: "123456", description: "6-digit email verification code" })
  @IsString()
  @Matches(/^\d{6}$/, { message: "Code must be 6 digits" })
  code!: string;
}

export class ChangePendingEmailDto {
  @ApiProperty({ example: "correct@email.com", description: "The corrected email address" })
  @IsEmail()
  email!: string;
}

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  MaxLength,
} from "class-validator";

export class RegisterDto {
  @ApiProperty({ example: "sara@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "S3cure!pass", minLength: 8 })
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  @MaxLength(72)
  @Matches(/[A-Za-z]/, { message: "Password must contain a letter" })
  @Matches(/\d/, { message: "Password must contain a number" })
  password!: string;

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

  @ApiPropertyOptional({ example: "+966500000000" })
  @IsOptional()
  @Matches(/^\+?[0-9]{9,15}$/, { message: "Invalid phone number" })
  phone?: string;
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

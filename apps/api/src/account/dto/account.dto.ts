import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  lastName?: string;

  @ApiPropertyOptional({ example: "+966500000000" })
  @IsOptional()
  @Matches(/^\+?[0-9]{9,15}$/, { message: "Invalid phone number" })
  phone?: string;

  @ApiPropertyOptional({ enum: ["ar", "en"] })
  @IsOptional()
  @IsIn(["ar", "en"])
  locale?: "ar" | "en";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/[A-Za-z]/, { message: "Password must contain a letter" })
  @Matches(/\d/, { message: "Password must contain a number" })
  newPassword!: string;
}

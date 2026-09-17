import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class FoundReportDto {
  @ApiProperty({ example: "Found her near Al Olaya park, she's safe with me." })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  message!: string;

  @ApiPropertyOptional({ example: "0501234567", description: "Optional — shown to the owner only" })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() || undefined : value))
  @IsString()
  @Matches(/^\+?[0-9\s()-]{8,20}$/, { message: "Invalid phone number" })
  finderPhone?: string;
}

import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";

const TYPES = [
  "DRY_FOOD", "WET_FOOD", "TREATS", "LITTER", "SHAMPOO", "ACCESSORY", "TOY",
  "BED", "BOWL", "CARRIER", "SCRATCHING_POST", "HEALTHCARE", "VITAMIN",
  "SUPPLEMENT", "GROOMING", "OTHER",
] as const;

export class CreateProductDto {
  @ApiProperty() @IsString() slug!: string;
  @ApiProperty() @IsString() sku!: string;
  @ApiProperty({ enum: TYPES }) @IsIn(TYPES) type!: (typeof TYPES)[number];
  @ApiProperty() @IsString() nameEn!: string;
  @ApiProperty() @IsString() nameAr!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descriptionEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descriptionAr?: string;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) price!: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) costPrice?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() brandId?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

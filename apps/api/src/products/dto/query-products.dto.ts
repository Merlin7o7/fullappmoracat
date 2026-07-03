import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export const PRODUCT_TYPES = [
  "DRY_FOOD", "WET_FOOD", "TREATS", "LITTER", "SHAMPOO", "ACCESSORY",
  "TOY", "BED", "BOWL", "CARRIER", "SCRATCHING_POST", "HEALTHCARE",
  "VITAMIN", "SUPPLEMENT", "GROOMING", "OTHER",
] as const;

const SORTS = ["newest", "price_asc", "price_desc", "rating"] as const;

export class QueryProductsDto {
  @ApiPropertyOptional({ enum: PRODUCT_TYPES })
  @IsOptional()
  @IsIn(PRODUCT_TYPES)
  type?: (typeof PRODUCT_TYPES)[number];

  @ApiPropertyOptional({ description: "Brand slug" })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ description: "Free-text search (name)" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: SORTS, default: "newest" })
  @IsOptional()
  @IsIn(SORTS)
  sort?: (typeof SORTS)[number];

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 12, maximum: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  limit?: number = 12;
}

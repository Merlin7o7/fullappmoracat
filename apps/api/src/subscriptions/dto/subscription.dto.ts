import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  Max,
  ValidateNested,
  ArrayMinSize,
} from "class-validator";

const INTERVALS = ["MONTHLY", "BIMONTHLY", "QUARTERLY", "CUSTOM"] as const;

export class SubItemDto {
  @ApiProperty()
  @IsString()
  productId!: string;

  @ApiProperty({ default: 1 })
  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}

export class CreateSubscriptionDto {
  @ApiPropertyOptional({ description: "Plan id (optional for fully custom boxes)" })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiProperty({ enum: INTERVALS, default: "MONTHLY" })
  @IsIn(INTERVALS)
  interval!: (typeof INTERVALS)[number];

  @ApiPropertyOptional({ description: "Required when interval = CUSTOM" })
  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(180)
  intervalDays?: number;

  @ApiProperty({ type: [String], description: "Cat ids this box is for" })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  catIds!: string[];

  @ApiPropertyOptional({ type: [SubItemDto], description: "Additional à-la-carte items" })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubItemDto)
  items?: SubItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isGift?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  giftRecipient?: string;
}

export class PauseDto {
  @ApiPropertyOptional({ description: "Resume automatically after this date (ISO)" })
  @IsOptional()
  @IsString()
  until?: string;
}

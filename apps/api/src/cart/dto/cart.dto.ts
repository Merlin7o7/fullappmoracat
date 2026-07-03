import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Min, Max } from "class-validator";

export class AddItemDto {
  @ApiProperty()
  @IsString()
  productId!: string;

  @ApiProperty({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  quantity?: number = 1;
}

export class UpdateItemDto {
  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(0) // 0 removes the line
  @Max(99)
  quantity!: number;
}

export class ApplyCouponDto {
  @ApiProperty({ example: "WELCOME10" })
  @IsString()
  code!: string;
}

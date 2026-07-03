import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateAddressDto {
  @ApiPropertyOptional({ example: "Home" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  recipient!: string;

  @ApiProperty({ example: "+966500000000" })
  @IsString()
  phone!: string;

  @ApiProperty({ description: "City id" })
  @IsString()
  cityId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  district?: string;

  @ApiProperty()
  @IsString()
  street!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  building?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apartment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto extends PartialType(CreateAddressDto) {}

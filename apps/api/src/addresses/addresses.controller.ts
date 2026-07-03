import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { AddressesService } from "./addresses.service";
import { CreateAddressDto, UpdateAddressDto } from "./dto/address.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";

@ApiTags("addresses")
@ApiBearerAuth()
@Controller("addresses")
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  @ApiOperation({ summary: "List saved addresses" })
  list(@CurrentUser("id") userId: string) {
    return this.addresses.list(userId);
  }

  @Post()
  @ApiOperation({ summary: "Add an address" })
  create(@CurrentUser("id") userId: string, @Body() dto: CreateAddressDto) {
    return this.addresses.create(userId, dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update an address" })
  update(@CurrentUser("id") userId: string, @Param("id") id: string, @Body() dto: UpdateAddressDto) {
    return this.addresses.update(userId, id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Remove an address" })
  remove(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.addresses.remove(userId, id);
  }
}

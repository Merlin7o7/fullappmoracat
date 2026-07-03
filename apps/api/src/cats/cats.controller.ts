import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { CatsService } from "./cats.service";
import { CreateCatDto, UpdateCatDto } from "./dto/cat.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";

@ApiTags("cats")
@ApiBearerAuth()
@Controller("cats")
export class CatsController {
  constructor(private readonly cats: CatsService) {}

  @Post()
  @ApiOperation({ summary: "Add a cat to the current user" })
  create(@CurrentUser("id") userId: string, @Body() dto: CreateCatDto) {
    return this.cats.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: "List the current user's cats" })
  findAll(@CurrentUser("id") userId: string) {
    return this.cats.findAll(userId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get one cat (owned by the current user)" })
  findOne(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.cats.findOne(userId, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a cat" })
  update(
    @CurrentUser("id") userId: string,
    @Param("id") id: string,
    @Body() dto: UpdateCatDto
  ) {
    return this.cats.update(userId, id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Remove a cat" })
  remove(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.cats.remove(userId, id);
  }
}

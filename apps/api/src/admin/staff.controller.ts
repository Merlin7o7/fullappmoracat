import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { IsEmail, IsString } from "class-validator";
import { AdminStaffService } from "./staff.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";

class AssignRoleDto {
  @IsEmail() email!: string;
  @IsString() roleKey!: string;
}

@ApiTags("admin")
@ApiBearerAuth()
@Controller("admin/staff")
export class AdminStaffController {
  constructor(private readonly staff: AdminStaffService) {}

  @Get("roles")
  @RequirePermissions("settings.write")
  @ApiOperation({ summary: "List assignable roles + their permission grants" })
  roles() {
    return this.staff.listRoles();
  }

  @Get()
  @RequirePermissions("settings.write")
  @ApiOperation({ summary: "List staff members and their roles" })
  list() {
    return this.staff.listStaff();
  }

  @Post()
  @RequirePermissions("settings.write")
  @ApiOperation({ summary: "Assign a role to a user (promotes to staff)" })
  assign(@CurrentUser("id") actorId: string, @Body() dto: AssignRoleDto) {
    return this.staff.assignRole(actorId, dto.email, dto.roleKey);
  }

  @Delete(":userId/roles/:roleKey")
  @RequirePermissions("settings.write")
  @ApiOperation({ summary: "Remove one role from a staff member" })
  removeRole(
    @CurrentUser("id") actorId: string,
    @Param("userId") userId: string,
    @Param("roleKey") roleKey: string
  ) {
    return this.staff.removeRole(actorId, userId, roleKey);
  }

  @Delete(":userId")
  @RequirePermissions("settings.write")
  @ApiOperation({ summary: "Revoke all staff access from a user" })
  revoke(@CurrentUser("id") actorId: string, @Param("userId") userId: string) {
    return this.staff.revokeStaff(actorId, userId);
  }
}

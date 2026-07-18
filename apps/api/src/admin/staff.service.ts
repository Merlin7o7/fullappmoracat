import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Staff & role administration — the path that was missing (onboarding a staff
 * member previously required hand-editing the database). Assigning a role sets
 * `isStaff` and replaces the user's role grants; revoking clears both and kills
 * their sessions. Guarded by `settings.write` (super-admin / owner only).
 */
@Injectable()
export class AdminStaffService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The signed-in staff member's own permission keys — powers the
   * permission-aware admin nav (a support agent only sees what they can open).
   * Same query the PermissionsGuard runs per-request, exposed once for the UI.
   */
  async myPermissions(userId: string) {
    const grants = await this.prisma.permission.findMany({
      where: { roles: { some: { role: { users: { some: { userId } } } } } },
      select: { key: true },
      orderBy: { key: "asc" },
    });
    return { permissions: grants.map((g) => g.key) };
  }

  /**
   * The signed-in staff member's own permission keys — powers the
   * permission-aware admin nav (a support agent only sees what they can open).
   * Same query the PermissionsGuard runs per-request, exposed once for the UI.
   */
  async myPermissions(userId: string) {
    const grants = await this.prisma.permission.findMany({
      where: { roles: { some: { role: { users: { some: { userId } } } } } },
      select: { key: true },
      orderBy: { key: "asc" },
    });
    return { permissions: grants.map((g) => g.key) };
  }

  /** All assignable roles + the permission keys each grants (for the UI). */
  async listRoles() {
    const roles = await this.prisma.role.findMany({
      orderBy: { name: "asc" },
      include: { permissions: { include: { permission: { select: { key: true } } } } },
    });
    return roles.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      scope: r.scope,
      isSystem: r.isSystem,
      permissions: r.permissions.map((rp) => rp.permission.key).sort(),
    }));
  }

  /** Current staff members with their assigned roles. */
  async listStaff() {
    const staff = await this.prisma.user.findMany({
      where: { isStaff: true, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        createdAt: true,
        roleAssignments: { include: { role: { select: { key: true, name: true } } } },
      },
    });
    return staff.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      status: u.status,
      createdAt: u.createdAt,
      roles: u.roleAssignments.map((ur) => ({ key: ur.role.key, name: ur.role.name })),
    }));
  }

  /** Grant a role to a user (by email), promoting them to staff. */
  async assignRole(actorId: string, email: string, roleKey: string) {
    const [user, role] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } }),
      this.prisma.role.findUnique({ where: { key: roleKey } }),
    ]);
    if (!user) throw new NotFoundException("No account with that email");
    if (user.deletedAt) throw new BadRequestException("That account is deactivated");
    if (!role) throw new NotFoundException("Unknown role");

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { isStaff: true } }),
      this.prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        update: {},
        create: { userId: user.id, roleId: role.id },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: actorId,
          action: "staff.role.assign",
          entityType: "User",
          entityId: user.id,
          metadata: { roleKey: role.key },
        },
      }),
    ]);
    return { ok: true, userId: user.id, role: role.key };
  }

  /** Remove a single role from a staff member. Demotes to non-staff if it was their last. */
  async removeRole(actorId: string, userId: string, roleKey: string) {
    if (userId === actorId) {
      throw new ForbiddenException("You can't change your own staff roles");
    }
    const role = await this.prisma.role.findUnique({ where: { key: roleKey } });
    if (!role) throw new NotFoundException("Unknown role");

    await this.prisma.userRole.deleteMany({ where: { userId, roleId: role.id } });
    const remaining = await this.prisma.userRole.count({ where: { userId } });
    if (remaining === 0) {
      // No roles left → no longer staff; revoke sessions so access ends now.
      await this.prisma.$transaction([
        this.prisma.user.update({ where: { id: userId }, data: { isStaff: false } }),
        this.prisma.deviceSession.deleteMany({ where: { userId } }),
      ]);
    }
    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: "staff.role.remove",
        entityType: "User",
        entityId: userId,
        metadata: { roleKey, demoted: remaining === 0 },
      },
    });
    return { ok: true, demoted: remaining === 0 };
  }

  /** Fully revoke staff access: drop all roles, clear isStaff, kill sessions. */
  async revokeStaff(actorId: string, userId: string) {
    if (userId === actorId) {
      throw new ForbiddenException("You can't revoke your own staff access");
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { isStaff: true } });
    if (!user) throw new NotFoundException("User not found");

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId } }),
      this.prisma.user.update({ where: { id: userId }, data: { isStaff: false } }),
      this.prisma.deviceSession.deleteMany({ where: { userId } }),
      this.prisma.auditLog.create({
        data: { userId: actorId, action: "staff.revoke", entityType: "User", entityId: userId },
      }),
    ]);
    return { ok: true };
  }
}

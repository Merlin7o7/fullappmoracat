import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { Prisma } from "@moraqat/db";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import type { CreateTicketDto } from "./dto/support.dto";

/**
 * Ticket lifecycle:
 *   customer creates      → OPEN      (ball with support)
 *   staff replies         → PENDING   (ball with customer)
 *   customer replies      → OPEN      (ball back with support)
 *   staff resolves        → RESOLVED  (customer reply re-opens)
 *   close (either side)   → CLOSED    (terminal; no further replies)
 */
@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService
  ) {}

  // ── Customer side ─────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateTicketDto) {
    const ticket = await this.prisma.supportTicket.create({
      data: {
        ticketNumber: makeTicketNumber(),
        userId,
        subject: dto.subject,
        category: dto.category,
        priority: dto.priority ?? "NORMAL",
        status: "OPEN",
        messages: { create: { authorId: userId, body: dto.message, isStaff: false } },
      },
      include: ticketInclude,
    });
    return this.serialize(ticket);
  }

  async listMine(userId: string) {
    const tickets = await this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: ticketInclude,
    });
    return tickets.map((t) => this.serialize(t));
  }

  async getMine(userId: string, ticketNumber: string) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { ticketNumber, userId },
      include: ticketInclude,
    });
    if (!ticket) throw new NotFoundException("Ticket not found");
    return this.serialize(ticket);
  }

  async replyAsCustomer(userId: string, ticketNumber: string, body: string) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { ticketNumber, userId },
    });
    if (!ticket) throw new NotFoundException("Ticket not found");
    if (ticket.status === "CLOSED") throw new BadRequestException("Ticket is closed");

    await this.prisma.$transaction([
      this.prisma.ticketMessage.create({
        data: { ticketId: ticket.id, authorId: userId, body, isStaff: false },
      }),
      // Customer reply always puts the ball back with support.
      this.prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: "OPEN" } }),
    ]);
    return this.getMine(userId, ticketNumber);
  }

  async closeAsCustomer(userId: string, ticketNumber: string) {
    const ticket = await this.prisma.supportTicket.findFirst({ where: { ticketNumber, userId } });
    if (!ticket) throw new NotFoundException("Ticket not found");
    await this.prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: "CLOSED" } });
    return this.getMine(userId, ticketNumber);
  }

  // ── Staff side ────────────────────────────────────────────────────────────

  async listAll(status?: string) {
    const where: Prisma.SupportTicketWhereInput = status ? { status: status as never } : {};
    const tickets = await this.prisma.supportTicket.findMany({
      where,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      include: {
        ...ticketInclude,
        user: { select: { email: true, firstName: true, lastName: true } },
      },
    });
    return tickets.map((t) => ({
      ...this.serialize(t),
      customer: {
        email: t.user.email,
        name: [t.user.firstName, t.user.lastName].filter(Boolean).join(" ") || t.user.email,
      },
    }));
  }

  async getAny(ticketNumber: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { ticketNumber },
      include: {
        ...ticketInclude,
        user: { select: { email: true, firstName: true, lastName: true } },
      },
    });
    if (!ticket) throw new NotFoundException("Ticket not found");
    return {
      ...this.serialize(ticket),
      customer: {
        email: ticket.user.email,
        name: [ticket.user.firstName, ticket.user.lastName].filter(Boolean).join(" ") || ticket.user.email,
      },
    };
  }

  async replyAsStaff(staffId: string, ticketNumber: string, body: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { ticketNumber } });
    if (!ticket) throw new NotFoundException("Ticket not found");
    if (ticket.status === "CLOSED") throw new BadRequestException("Ticket is closed");

    await this.prisma.$transaction([
      this.prisma.ticketMessage.create({
        data: { ticketId: ticket.id, authorId: staffId, body, isStaff: true },
      }),
      // Staff reply hands the ball to the customer.
      this.prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: "PENDING" } }),
    ]);

    await this.notifications.notify(ticket.userId, {
      category: "SYSTEM",
      title: "Support replied to your ticket",
      body: `${ticket.ticketNumber}: ${ticket.subject}`,
      data: { ticketNumber: ticket.ticketNumber },
    });

    return this.getAny(ticketNumber);
  }

  async setStatus(ticketNumber: string, status: "RESOLVED" | "CLOSED") {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { ticketNumber } });
    if (!ticket) throw new NotFoundException("Ticket not found");
    await this.prisma.supportTicket.update({ where: { id: ticket.id }, data: { status } });

    if (status === "RESOLVED") {
      await this.notifications.notify(ticket.userId, {
        category: "SYSTEM",
        title: "Your ticket was resolved",
        body: `${ticket.ticketNumber}: ${ticket.subject}`,
        data: { ticketNumber: ticket.ticketNumber },
      });
    }
    return this.getAny(ticketNumber);
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private serialize(t: TicketWithMessages) {
    return {
      ticketNumber: t.ticketNumber,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      category: t.category,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      messages: t.messages.map((m) => ({
        id: m.id,
        body: m.body,
        isStaff: m.isStaff,
        createdAt: m.createdAt,
      })),
    };
  }
}

const ticketInclude = {
  messages: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.SupportTicketInclude;

type TicketWithMessages = Prisma.SupportTicketGetPayload<{ include: typeof ticketInclude }>;

function makeTicketNumber(): string {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `TKT-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

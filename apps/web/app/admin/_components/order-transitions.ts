"use client";

/**
 * Sensible forward transitions per order status — mirrors the server map in
 * apps/api/src/admin/admin-orders.service.ts (the API rejects anything else).
 * Terminal states (CANCELLED / RETURNED) have no exits: money moves out of them
 * only through the refund flow, never a status dropdown.
 */
export const ALLOWED_ORDER_TRANSITIONS: Record<string, readonly string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED", "FAILED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED", "FAILED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "FAILED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
  FAILED: ["CONFIRMED", "CANCELLED"],
};

/** Transitions that take money/fulfilment away — these confirm WITH a reason. */
export const DESTRUCTIVE_ORDER_STATUSES = ["CANCELLED", "RETURNED", "FAILED"];

/** Ordered fulfilment path for the order-detail status stepper. */
export const ORDER_STEPPER_PATH = [
  "PENDING", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED",
] as const;
